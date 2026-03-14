import Anthropic from "@anthropic-ai/sdk";
import type {
  GitHubData,
  SocialData,
  ReportScores,
  AdversarialReport,
} from "@publicround/shared";
import { CLAUDE_MODEL } from "./scorer.js";

const RED_TEAM_PROMPT = `You are an adversarial auditor for PublicRound, a startup transparency platform. Your job is to poke holes in a startup's data and find red flags that a bullish analyst might overlook.

You are given:
1. Raw data from a startup's GitHub and social profiles
2. The initial report card scores from the primary analyst

Your job is to be skeptical. Look for:
- FAKE TRACTION: High star counts but low contributor diversity, bot-like patterns, stars-to-forks ratio anomalies
- INFLATED ACTIVITY: Many commits but low code quality, trivial commits padding numbers, force-pushed history
- TEAM RED FLAGS: Single contributor doing 95%+ of work, inactive co-founders, no bus factor
- VANITY METRICS: Lots of open issues with no responses, high follower counts with low engagement
- CODE SMELL: No tests, no CI, no license (legal risk), stale dependencies, no documentation
- SOCIAL MANIPULATION: Bought followers, engagement farming, inconsistent posting patterns

For each red flag found, provide:
- What the flag is
- Why it matters
- Severity: "critical" | "warning" | "info"

Also provide an ADJUSTED score recommendation if you think the original scores are inflated.

Respond with ONLY valid JSON:
{
  "redFlags": [
    {
      "flag": "<description>",
      "reason": "<why it matters>",
      "severity": "critical" | "warning" | "info"
    }
  ],
  "adjustedScores": {
    "codeQuality": <number or null if no change>,
    "teamStrength": <number or null>,
    "traction": <number or null>,
    "socialPresence": <number or null>
  },
  "overallAssessment": "<1-2 sentence adversarial take>",
  "trustScore": <0-100, how much should we trust the primary analysis>
}`;

function computeTopContributorShare(contributors: GitHubData["contributors"]): string {
  if (contributors.length === 0) return "N/A";
  const total = contributors.reduce((sum, c) => sum + c.contributions, 0);
  if (total === 0) return "N/A";
  return ((contributors[0].contributions / total) * 100).toFixed(1) + "%";
}

export async function runAdversarialAudit(
  github: GitHubData,
  social: SocialData | null,
  originalScores: ReportScores
): Promise<AdversarialReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Here is the startup data and the primary analyst's scores. Find every red flag you can.

PRIMARY ANALYST SCORES:
${JSON.stringify(originalScores, null, 2)}

RAW DATA:
${JSON.stringify(
    {
      github: {
        repo: `${github.owner}/${github.repo}`,
        description: github.description,
        stars: github.stars,
        forks: github.forks,
        openIssues: github.openIssues,
        languages: github.languages,
        commitsLast30Days: github.totalCommits,
        contributors: github.contributors,
        hasReadme: github.hasReadme,
        hasLicense: github.hasLicense,
        hasCi: github.hasCi,
        createdAt: github.createdAt,
        updatedAt: github.updatedAt,
        recentCommitMessages: github.recentCommits.slice(0, 20).map((c) => c.message),
        starsToForksRatio: github.forks > 0 ? (github.stars / github.forks).toFixed(2) : "N/A",
        topContributorShare: computeTopContributorShare(github.contributors),
      },
      social: social || null,
    },
    null,
    2
  )}`;

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: RED_TEAM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const cleaned = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as AdversarialReport;
}
