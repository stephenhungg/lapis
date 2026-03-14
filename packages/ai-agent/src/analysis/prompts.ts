import type { GitHubData, SocialData } from "@publicround/shared";
import type { IndustrySentiment } from "../polymarket/client.js";

export const SYSTEM_PROMPT = `You are a startup technical due-diligence analyst for PublicRound, a platform that creates transparent startup valuations.

Your job is to analyze raw data from a startup's GitHub repository, social presence, and real-world market sentiment from Polymarket prediction markets, then produce a structured report card.

Score each category from 0 to 100 using these calibration guidelines:

CODE QUALITY (weight: 30%)
- 80-100: Active CI/CD, license, good docs, multiple languages, clean commit messages
- 60-79: Has most basics (README, some CI), decent commit history
- 40-59: Minimal docs, inconsistent commits, no CI
- 0-39: No README, no license, very few commits, looks abandoned

TEAM STRENGTH (weight: 25%)
- 80-100: 5+ active contributors, consistent commit patterns from multiple people
- 60-79: 3-4 contributors with regular activity
- 40-59: 1-2 contributors, some activity
- 0-39: Single contributor with minimal activity

TRACTION (weight: 30%)
- 80-100: 1000+ stars, 100+ forks, active issue discussions, recent updates
- 60-79: 100-999 stars, some forks, moderate activity
- 40-59: 10-99 stars, few forks, sporadic updates
- 0-39: Under 10 stars, looks like a side project

SOCIAL PRESENCE (weight: 15%)
- 80-100: 10k+ followers, high engagement, frequent posts
- 60-79: 1k-10k followers, moderate engagement
- 40-59: 100-1k followers, some activity
- 0-39: Under 100 followers or no social presence

IMPORTANT: If Polymarket sentiment data is provided, factor it into your analysis:
- Bullish industry sentiment should be noted as a tailwind (mention it in strengths if relevant)
- Bearish industry sentiment should be noted as a headwind (mention it in weaknesses if relevant)
- Reference specific prediction market questions when they are directly relevant
- This is MACRO context - it should influence your narrative and overall assessment, but individual scores should still be based primarily on the startup's own data

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "scores": {
    "codeQuality": <number 0-100>,
    "teamStrength": <number 0-100>,
    "traction": <number 0-100>,
    "socialPresence": <number 0-100>
  },
  "summary": "<2-3 sentence overall assessment, reference market sentiment if available>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...]
}

Be honest and data-driven. Do not inflate scores. 3-5 strengths and 3-5 weaknesses.`;

export function buildAnalysisPrompt(
  github: GitHubData,
  social: SocialData | null,
  industrySentiment?: IndustrySentiment[]
): string {
  const data: Record<string, unknown> = {
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
    },
    social: social
      ? {
          platform: social.platform,
          handle: social.handle,
          followers: social.followers,
          recentPostCount: social.recentPostCount,
          avgEngagement: social.avgEngagement,
        }
      : null,
  };

  // add polymarket sentiment if available
  if (industrySentiment && industrySentiment.length > 0) {
    data.polymarketSentiment = industrySentiment.map((s) => ({
      industry: s.industry,
      overallSentiment: s.overallSentiment,
      sentimentScore: s.sentimentScore,
      relatedMarkets: s.relatedMarkets.map((m) => ({
        question: m.question,
        probability: `${Math.round(m.yesPrice * 100)}%`,
        volume: m.volume,
      })),
    }));
  }

  return `Analyze this startup data and produce a report card:\n\n${JSON.stringify(data, null, 2)}`;
}
