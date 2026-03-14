import Anthropic from "@anthropic-ai/sdk";
import type { GitHubData, SocialData, ReportScores } from "@publicround/shared";
import type { IndustrySentiment } from "../polymarket/client.js";
import { SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts.js";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

interface AnalysisResult {
  scores: ReportScores;
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to your .env file.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseResponse(text: string): Omit<AnalysisResult, "scores"> & {
  scores: Omit<ReportScores, "overall">;
} {
  // strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

function computeOverall(scores: Omit<ReportScores, "overall">): number {
  return Math.round(
    scores.codeQuality * 0.3 +
      scores.teamStrength * 0.25 +
      scores.traction * 0.3 +
      scores.socialPresence * 0.15
  );
}

export async function analyzeStartup(
  github: GitHubData,
  social: SocialData | null,
  industrySentiment?: IndustrySentiment[]
): Promise<AnalysisResult> {
  const client = getClient();
  const userPrompt = buildAnalysisPrompt(github, social, industrySentiment);

  let lastError: Error | null = null;

  // try up to 2 times in case of JSON parse failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      const parsed = parseResponse(content.text);
      const overall = computeOverall(parsed.scores);

      return {
        scores: { ...parsed.scores, overall },
        summary: parsed.summary,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
      };
    } catch (err) {
      lastError = err as Error;
      console.error(`Analysis attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`Analysis failed after 2 attempts: ${lastError?.message}`);
}
