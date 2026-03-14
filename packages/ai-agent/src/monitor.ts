import { scrapeGitHub } from "./scrapers/index.js";
import { analyzeStartup } from "./analysis/index.js";
import { getIndustrySentiment } from "./polymarket/index.js";
import {
  getMarketByReport,
  placeBet,
  estimateValuation,
} from "./polymarket/index.js";
import { getReport, updateReport } from "./store.js";
import { onScoreChange } from "./xrpl/index.js";
import type { GitHubData } from "@lapis/shared";

interface MonitoredRepo {
  reportId: string;
  githubUrl: string;
  intervalMs: number;
  lastCommitSha: string | null;
  lastScore: number | null;
  timer: ReturnType<typeof setInterval> | null;
}

const monitored = new Map<string, MonitoredRepo>();

function hasRepoChanged(
  oldData: GitHubData | null,
  newData: GitHubData
): { changed: boolean; reason: string } {
  if (!oldData) return { changed: true, reason: "initial scan" };

  // check if latest commit changed
  const oldLatest = oldData.recentCommits[0]?.sha;
  const newLatest = newData.recentCommits[0]?.sha;
  if (oldLatest !== newLatest) {
    return { changed: true, reason: `new commit: ${newData.recentCommits[0]?.message?.slice(0, 60)}` };
  }

  // check if stars changed significantly (>5% change)
  const starDiff = Math.abs(newData.stars - oldData.stars);
  if (starDiff > oldData.stars * 0.05 && starDiff > 10) {
    return { changed: true, reason: `stars changed: ${oldData.stars} -> ${newData.stars}` };
  }

  // check if contributor count changed
  if (newData.contributors.length !== oldData.contributors.length) {
    return { changed: true, reason: `contributor count changed: ${oldData.contributors.length} -> ${newData.contributors.length}` };
  }

  return { changed: false, reason: "no significant changes" };
}

async function checkAndUpdate(reportId: string): Promise<void> {
  const entry = monitored.get(reportId);
  if (!entry) return;

  const report = await getReport(reportId);
  if (!report || report.status === "error") {
    console.log(`[monitor] ${reportId} - report not found or errored, stopping`);
    stopMonitoring(reportId);
    return;
  }

  try {
    console.log(`[monitor] ${reportId} - checking for changes...`);
    const newGithubData = await scrapeGitHub(entry.githubUrl);
    const { changed, reason } = hasRepoChanged(report.githubData, newGithubData);

    if (!changed) {
      console.log(`[monitor] ${reportId} - no changes detected`);
      return;
    }

    console.log(`[monitor] ${reportId} - change detected: ${reason}`);
    console.log(`[monitor] ${reportId} - re-analyzing...`);

    // fetch fresh sentiment
    let sentiment;
    try {
      sentiment = await getIndustrySentiment(
        newGithubData.description,
        newGithubData.languages,
        newGithubData.repo
      );
    } catch {
      // non-critical
    }

    // re-run analysis
    const { scores, summary, strengths, weaknesses } = await analyzeStartup(
      newGithubData,
      report.socialData,
      sentiment
    );

    const oldScore = entry.lastScore;
    entry.lastScore = scores.overall;
    entry.lastCommitSha = newGithubData.recentCommits[0]?.sha ?? null;

    // update the report
    await updateReport(reportId, {
      githubData: newGithubData,
      scores,
      summary,
      strengths,
      weaknesses,
    });

    console.log(
      `[monitor] ${reportId} - score updated: ${oldScore} -> ${scores.overall}`
    );

    // hook into XRPL: if score dropped significantly, agent reacts
    if (oldScore !== null && oldScore !== scores.overall) {
      onScoreChange(reportId, oldScore, scores.overall).catch((err) =>
        console.warn(`[monitor] ${reportId} - xrpl hook failed:`, (err as Error).message)
      );
    }

    // agent adjusts market position if score changed
    const market = await getMarketByReport(reportId);
    if (market && market.status === "open" && oldScore !== null && oldScore !== scores.overall) {
      const { valuation, confidence } = estimateValuation(scores.overall);
      try {
        await placeBet(market.id, "ai-agent-monitor", valuation, confidence);
        console.log(
          `[monitor] ${reportId} - agent adjusted market position: $${valuation}M (confidence: ${confidence})`
        );
      } catch (err) {
        console.warn(`[monitor] ${reportId} - failed to adjust market:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error(`[monitor] ${reportId} - check failed:`, (err as Error).message);
  }
}

export async function startMonitoring(
  reportId: string,
  githubUrl: string,
  intervalMs: number = 30_000 // default: check every 30 seconds
): Promise<MonitoredRepo> {
  // stop existing monitor if any
  stopMonitoring(reportId);

  const report = await getReport(reportId);
  const entry: MonitoredRepo = {
    reportId,
    githubUrl,
    intervalMs,
    lastCommitSha: report?.githubData?.recentCommits[0]?.sha ?? null,
    lastScore: report?.scores?.overall ?? null,
    timer: null,
  };

  entry.timer = setInterval(() => {
    checkAndUpdate(reportId);
  }, intervalMs);

  monitored.set(reportId, entry);
  console.log(
    `[monitor] started watching ${githubUrl} (report ${reportId}) every ${intervalMs / 1000}s`
  );

  return entry;
}

export function stopMonitoring(reportId: string): boolean {
  const entry = monitored.get(reportId);
  if (!entry) return false;

  if (entry.timer) clearInterval(entry.timer);
  monitored.delete(reportId);
  console.log(`[monitor] stopped watching report ${reportId}`);
  return true;
}

export function getMonitoredRepos(): Array<{
  reportId: string;
  githubUrl: string;
  intervalMs: number;
  lastScore: number | null;
}> {
  return Array.from(monitored.values()).map((m) => ({
    reportId: m.reportId,
    githubUrl: m.githubUrl,
    intervalMs: m.intervalMs,
    lastScore: m.lastScore,
  }));
}

export function isMonitoring(reportId: string): boolean {
  return monitored.has(reportId);
}
