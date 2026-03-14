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

const NEURAL_VAL_HISTORY = [
  { time: "48h", value: 6100000 }, { time: "46h", value: 6350000 },
  { time: "44h", value: 6200000 }, { time: "42h", value: 6800000 },
  { time: "40h", value: 6950000 }, { time: "38h", value: 6700000 },
  { time: "36h", value: 7100000 }, { time: "34h", value: 7300000 },
  { time: "32h", value: 7150000 }, { time: "30h", value: 7450000 },
  { time: "28h", value: 7600000 }, { time: "26h", value: 7900000 },
  { time: "24h", value: 7750000 }, { time: "22h", value: 8000000 },
  { time: "20h", value: 8100000 }, { time: "18h", value: 7800000 },
  { time: "16h", value: 8050000 }, { time: "14h", value: 8300000 },
  { time: "12h", value: 8200000 }, { time: "10h", value: 8150000 },
  { time: "8h",  value: 8350000 }, { time: "6h",  value: 8100000 },
  { time: "4h",  value: 8250000 }, { time: "2h",  value: 8200000 },
  { time: "now", value: 8200000 },
];

const CHAIN_VAL_HISTORY = [
  { time: "48h", value: 3800000 }, { time: "44h", value: 4100000 },
  { time: "40h", value: 3950000 }, { time: "36h", value: 4300000 },
  { time: "32h", value: 4500000 }, { time: "28h", value: 4800000 },
  { time: "24h", value: 4600000 }, { time: "20h", value: 4900000 },
  { time: "16h", value: 5000000 }, { time: "12h", value: 5200000 },
  { time: "8h",  value: 5050000 }, { time: "4h",  value: 5100000 },
  { time: "now", value: 5100000 },
];

const STACK_VAL_HISTORY = [
  { time: "72h", value: 10200000 }, { time: "60h", value: 11500000 },
  { time: "48h", value: 11000000 }, { time: "36h", value: 12300000 },
  { time: "24h", value: 13100000 }, { time: "12h", value: 14000000 },
  { time: "6h",  value: 14300000 }, { time: "now", value: 14500000 },
];

export const STARTUPS: Startup[] = [
  {
    id: "neuralEdge",
    name: "NeuralEdge",
    description: "AI-powered edge inference platform for real-time ML deployment without cloud latency.",
    founder: "Alex Chen",
    founderTitle: "CEO & Co-founder",
    twitter: "@alexchen_dev",
    github: "github.com/neuralEdge/core",
    website: "neuraledge.ai",
    founded: "2024",
    stage: "Pre-seed",
    scores: { codeQuality: 87, team: 74, traction: 91, social: 78, overall: 84 },
    strengths: [
      "94% test coverage with comprehensive CI/CD pipeline",
      "3,200 GitHub stars in 8 months of public development",
      "$12K MRR growing 18% month-over-month",
    ],
    risks: [
      "Competitive market with Cloudflare Workers AI and Vercel AI",
      "No enterprise contracts yet — all self-serve",
    ],
    redFlags: [
      "Commit frequency dropped 40% in the past 30 days",
      "Two of five core contributors went inactive in January",
    ],
    equityOffered: 8,
    valuationCap: 8200000,
    currentBet: 8200000,
    volume: 142300,
    bettors: 312,
    hoursLeft: 47,
    aiPosition: 8000000,
    safeStatus: "open",
    valHistory: NEURAL_VAL_HISTORY,
    languages: { TypeScript: 62, Python: 24, Rust: 10, Other: 4 },
    commitFrequency: [
      { month: "Aug", commits: 82, additions: 4200, deletions: 1100 },
      { month: "Sep", commits: 91, additions: 5100, deletions: 1800 },
      { month: "Oct", commits: 78, additions: 3900, deletions: 1400 },
      { month: "Nov", commits: 103, additions: 6200, deletions: 2100 },
      { month: "Dec", commits: 67, additions: 3100, deletions: 900 },
      { month: "Jan", commits: 44, additions: 2200, deletions: 700 },
      { month: "Feb", commits: 38, additions: 1800, deletions: 600 },
      { month: "Mar", commits: 41, additions: 2100, deletions: 750 },
    ],
    macroSignals: [
      { label: "Edge AI market (Polymarket)", value: "71% growing this yr", direction: "up" },
      { label: "Venture sentiment index", value: "62/100 bullish", direction: "up" },
      { label: "Cloudflare comp raise", value: "$1.2B Series F — pressure", direction: "down" },
      { label: "XRPL DeFi TVL", value: "+18% WoW", direction: "up" },
    ],
  },
  {
    id: "chainLedger",
    name: "ChainLedger",
    description: "Decentralized accounting protocol for Web3-native businesses — automates on-chain bookkeeping.",
    founder: "Sarah Kim",
    founderTitle: "CEO & Co-founder",
    twitter: "@sarahkim_web3",
    github: "github.com/chainledger/protocol",
    website: "chainledger.xyz",
    founded: "2024",
    stage: "Pre-seed",
    scores: { codeQuality: 71, team: 82, traction: 63, social: 85, overall: 75 },
    strengths: [
      "2x repeat founders with prior fintech exit ($4M acquisition)",
      "Active 150-member Discord community",
      "Live on Ethereum and Polygon testnet",
    ],
    risks: [
      "Zero revenue — pre-product market fit",
      "Regulatory uncertainty around on-chain accounting",
    ],
    redFlags: [
      "Only 1 active engineer on the core protocol",
      "No mainnet deployment yet despite 14 months of development",
    ],
    equityOffered: 10,
    valuationCap: 5100000,
    currentBet: 5100000,
    volume: 89200,
    bettors: 187,
    hoursLeft: 12,
    aiPosition: 5000000,
    safeStatus: "open",
    valHistory: CHAIN_VAL_HISTORY,
    languages: { Solidity: 45, TypeScript: 40, JavaScript: 15 },
    commitFrequency: [
      { month: "Aug", commits: 34, additions: 1800, deletions: 400 },
      { month: "Sep", commits: 41, additions: 2100, deletions: 600 },
      { month: "Oct", commits: 38, additions: 1900, deletions: 500 },
      { month: "Nov", commits: 52, additions: 2600, deletions: 900 },
      { month: "Dec", commits: 29, additions: 1400, deletions: 300 },
      { month: "Jan", commits: 31, additions: 1600, deletions: 400 },
      { month: "Feb", commits: 27, additions: 1300, deletions: 350 },
      { month: "Mar", commits: 24, additions: 1200, deletions: 300 },
    ],
    macroSignals: [
      { label: "Web3 accounting tools sentiment", value: "48% bullish", direction: "neutral" },
      { label: "DeFi regulatory risk (Polymarket)", value: "67% regulated by 2026", direction: "down" },
      { label: "XRPL EVM launch success", value: "82% likely", direction: "up" },
    ],
  },
  {
    id: "stackFlow",
    name: "StackFlow",
    description: "AI code review copilot that learns your codebase conventions and enforces them automatically.",
    founder: "Marcus Rivera",
    founderTitle: "Founder & CTO",
    twitter: "@mrivera_code",
    github: "github.com/stackflow/ai",
    website: "stackflow.dev",
    founded: "2023",
    stage: "Seed",
    scores: { codeQuality: 92, team: 79, traction: 88, social: 71, overall: 88 },
    strengths: [
      "Top 1% GitHub activity — 4,800 stars, 120+ contributors",
      "$28K MRR with 5 active enterprise pilots",
      "Proprietary fine-tuned model trained on 10M code reviews",
    ],
    risks: [
      "Heavy dependency on OpenAI API — margin risk if costs rise",
      "GitHub Copilot expanding into code review directly",
    ],
    redFlags: [],
    equityOffered: 6,
    valuationCap: 14500000,
    currentBet: 14500000,
    volume: 312400,
    bettors: 891,
    hoursLeft: 0,
    aiPosition: 14000000,
    safeStatus: "settled",
    valHistory: STACK_VAL_HISTORY,
    languages: { TypeScript: 78, Python: 14, Go: 8 },
    commitFrequency: [
      { month: "Aug", commits: 124, additions: 7200, deletions: 2800 },
      { month: "Sep", commits: 138, additions: 8100, deletions: 3100 },
      { month: "Oct", commits: 119, additions: 6800, deletions: 2400 },
      { month: "Nov", commits: 152, additions: 9300, deletions: 3600 },
      { month: "Dec", commits: 108, additions: 6200, deletions: 2100 },
      { month: "Jan", commits: 143, additions: 8700, deletions: 3200 },
      { month: "Feb", commits: 161, additions: 9800, deletions: 3800 },
      { month: "Mar", commits: 148, additions: 9100, deletions: 3400 },
    ],
    macroSignals: [
      { label: "AI dev tools market", value: "94% growing YoY", direction: "up" },
      { label: "GitHub Copilot expansion risk", value: "71% enters review", direction: "down" },
      { label: "Seed round valuations (dev tools)", value: "$12M avg — in-range", direction: "neutral" },
    ],
  },
];

export function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
