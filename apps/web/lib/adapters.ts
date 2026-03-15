import type { ReportCard, ValuationMarket, SettlementResult } from "./api-types";

// ==========================================
// Display types (used by UI components)
// ==========================================

export type SafeStatus = "open" | "settled" | "analyzing";

export interface Startup {
  id: string;
  name: string;
  description: string;
  founder: string;
  founderTitle: string;
  twitter: string;
  github: string;
  website: string;
  founded: string;
  stage: string;
  scores: {
    codeQuality: number;
    team: number;
    traction: number;
    social: number;
    overall: number;
  };
  strengths: string[];
  risks: string[];
  redFlags: string[];
  equityOffered: number;
  valuationCap: number;
  currentBet: number;
  volume: number;
  bettors: number;
  hoursLeft: number;
  aiPosition: number;
  safeStatus: SafeStatus;
  valHistory: { time: string; value: number }[];
  languages: Record<string, number>;
  commitFrequency: { month: string; commits: number; additions: number; deletions: number }[];
  macroSignals: { label: string; value: string; direction: "up" | "down" | "neutral" }[];
}

/** Format a dollar amount for display */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

/**
 * Convert backend ReportCard + optional market/settlement into the
 * Startup shape that existing UI components expect.
 */
export function adaptReportToStartup(
  report: ReportCard,
  market?: ValuationMarket | null,
  settlement?: SettlementResult | null
): Startup {
  const scores = report.scores;
  const gh = report.githubData;
  const owner = gh?.owner ?? "unknown";
  const repo = gh?.repo ?? "unknown";

  // derive safe status from market + settlement
  let safeStatus: SafeStatus = "analyzing";
  if (report.status === "complete") {
    safeStatus = settlement ? "settled" : "open";
  }

  // derive market stats
  const humanBets = market?.bets.filter((b) => !b.userId.startsWith("ai-agent")) ?? [];
  const totalVolume = market?.bets.reduce((s, b) => s + b.amount, 0) ?? 0;
  const consensusRaw = market?.consensusValuation ?? 0; // in millions
  const consensusDollars = consensusRaw * 1_000_000;

  // figure out hours left (markets open for ~48h by convention)
  const openedAt = market?.openedAt ? new Date(market.openedAt).getTime() : Date.now();
  const msLeft = Math.max(0, openedAt + 48 * 60 * 60 * 1000 - Date.now());
  const hoursLeft = Math.round(msLeft / (60 * 60 * 1000));

  // derive commit frequency from raw commits (group by month)
  const commitFrequency = deriveCommitFrequency(gh?.recentCommits ?? []);

  // derive languages
  const languages = gh?.languages ?? {};

  // build valHistory starting point from consensus
  const valHistory = consensusDollars > 0
    ? [{ time: "now", value: consensusDollars }]
    : [];

  return {
    id: report.id,
    name: `${owner}/${repo}`,
    description: report.summary ?? gh?.description ?? "AI analysis in progress...",
    founder: owner,
    founderTitle: "Founder",
    twitter: report.socialData?.handle ? `@${report.socialData.handle}` : "",
    github: report.githubUrl.replace("https://", ""),
    website: "",
    founded: gh?.createdAt ? new Date(gh.createdAt).getFullYear().toString() : "",
    stage: "Pre-seed",
    scores: {
      codeQuality: scores?.codeQuality ?? 0,
      team: scores?.teamStrength ?? 0,
      traction: scores?.traction ?? 0,
      social: scores?.socialPresence ?? 0,
      overall: scores?.overall ?? 0,
    },
    strengths: report.strengths,
    risks: report.weaknesses,
    redFlags: report.adversarialReport?.redFlags.map((f) => f.flag) ?? [],
    equityOffered: 8, // default for display
    valuationCap: consensusDollars || (scores ? estimateValuationFromScore(scores.overall) : 5_000_000),
    currentBet: consensusDollars || 0,
    volume: totalVolume,
    bettors: humanBets.length,
    hoursLeft,
    aiPosition: market?.agentConfidence ?? 0,
    safeStatus,
    valHistory,
    languages,
    commitFrequency,
    macroSignals: [], // polymarket sentiment not exposed in report API
  };
}

/** Map 0-100 score to a rough dollar valuation (mirrors backend estimateValuation) */
function estimateValuationFromScore(score: number): number {
  const base = 0.5; // $500K
  return Math.round(base * Math.pow(1.05, score) * 1_000_000);
}

interface RawCommit {
  date: string;
  message: string;
}

/** Group raw commits by month for the commit frequency chart */
function deriveCommitFrequency(
  commits: RawCommit[]
): { month: string; commits: number; additions: number; deletions: number }[] {
  const months = new Map<string, number>();

  for (const c of commits) {
    const d = new Date(c.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, (months.get(key) ?? 0) + 1);
  }

  // sort and take last 8 months
  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([month, commits]) => ({
      month,
      commits,
      additions: commits * 120, // rough estimate
      deletions: commits * 40,
    }));
}

/**
 * Map SettlementResult to the portfolio MPT shape the UI expects.
 */
export function adaptSettlementToMPT(settlement: SettlementResult) {
  return {
    id: settlement.marketId,
    name: settlement.companyName,
    ticker: settlement.equityToken.companyName.slice(0, 4).toUpperCase(),
    mptAddress: settlement.equityToken.mptIssuanceId,
    valuationCap: settlement.consensusValuationM * 1_000_000,
    equity: 8, // default display
    tokensHeld: settlement.escrows.length > 0
      ? parseInt(settlement.escrows[0].sharesAllocated, 10)
      : 0,
    escrowStatus: "active" as const,
    vestingCliff: "3 months",
    vestingTotal: "1 year",
    safeDeployed: settlement.safe ? "Base" : "N/A",
  };
}
