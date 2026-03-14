import { scrapeGitHub, scrapeSocial } from "./scrapers/index.js";
import { analyzeStartup, runAdversarialAudit } from "./analysis/index.js";
import { getIndustrySentiment } from "./polymarket/index.js";
import { updateReport } from "./store.js";

export async function runAnalysisPipeline(
  reportId: string,
  githubUrl: string,
  twitterHandle?: string
): Promise<void> {
  try {
    await updateReport(reportId, { status: "scraping" });

    const [githubData, socialData] = await Promise.all([
      scrapeGitHub(githubUrl),
      scrapeSocial(twitterHandle),
    ]);

    await updateReport(reportId, {
      status: "analyzing",
      githubData,
      socialData,
    });

    // fetch polymarket sentiment in parallel with nothing blocking
    // (non-critical - if it fails, analysis still works without it)
    let industrySentiment;
    try {
      console.log(`Report ${reportId} fetching Polymarket sentiment...`);
      industrySentiment = await getIndustrySentiment(
        githubData.description,
        githubData.languages,
        githubData.repo
      );
      if (industrySentiment.length > 0) {
        const industries = industrySentiment.map(
          (s) => `${s.industry}(${s.overallSentiment})`
        );
        console.log(`Report ${reportId} sentiment: ${industries.join(", ")}`);
      }
    } catch (err) {
      console.warn(`Polymarket sentiment fetch failed, continuing without it:`, (err as Error).message);
    }

    // primary analysis with polymarket context
    const { scores, summary, strengths, weaknesses } = await analyzeStartup(
      githubData,
      socialData,
      industrySentiment
    );

    await updateReport(reportId, {
      scores,
      summary,
      strengths,
      weaknesses,
    });

    console.log(`Report ${reportId} primary analysis done. Score: ${scores.overall}`);

    // adversarial audit - runs after primary, non-blocking on completion
    try {
      console.log(`Report ${reportId} running adversarial audit...`);
      const adversarialReport = await runAdversarialAudit(
        githubData,
        socialData,
        scores
      );

      await updateReport(reportId, {
        status: "complete",
        adversarialReport,
        completedAt: new Date().toISOString(),
      });

      console.log(
        `Report ${reportId} complete. Trust score: ${adversarialReport.trustScore}/100, Red flags: ${adversarialReport.redFlags.length}`
      );
    } catch (auditErr) {
      // if adversarial audit fails, still mark as complete with primary results
      console.warn(
        `Adversarial audit failed for ${reportId}, completing with primary analysis only:`,
        (auditErr as Error).message
      );
      await updateReport(reportId, {
        status: "complete",
        completedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Pipeline failed for ${reportId}:`, message);
    await updateReport(reportId, {
      status: "error",
      error: message,
    });
  }
}
