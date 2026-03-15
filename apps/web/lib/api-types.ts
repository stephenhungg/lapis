// Backend type mirrors for frontend use
// These match the shapes from @lapis/shared and ai-agent

export interface ReportScores {
  codeQuality: number;
  teamStrength: number;
  traction: number;
  socialPresence: number;
  overall: number;
}

export interface CommitSummary {
  sha: string;
  message: string;
  date: string;
  author: string;
}

export interface ContributorSummary {
  login: string;
  contributions: number;
}

export interface GitHubData {
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
  languages: Record<string, number>;
  totalCommits: number;
  recentCommits: CommitSummary[];
  contributors: ContributorSummary[];
  createdAt: string;
  updatedAt: string;
  description: string | null;
  hasReadme: boolean;
  hasLicense: boolean;
  hasCi: boolean;
}

export interface SocialData {
  platform: "twitter";
  handle: string;
  followers: number;
  recentPostCount: number;
  avgEngagement: number;
}

export interface RedFlag {
  flag: string;
  reason: string;
  severity: "critical" | "warning" | "info";
}

export interface AdversarialReport {
  redFlags: RedFlag[];
  adjustedScores: {
    codeQuality: number | null;
    teamStrength: number | null;
    traction: number | null;
    socialPresence: number | null;
  };
  overallAssessment: string;
  trustScore: number;
}

export interface TokenMarketData {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  priceUsd: string;
  marketCap: number | null;
  fdv: number | null;
  liquidity: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  pairAddress: string;
  dexId: string;
  url: string;
}

export interface ReportCard {
  id: string;
  githubUrl: string;
  status: "pending" | "scraping" | "analyzing" | "complete" | "error";
  scores: ReportScores | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  githubData: GitHubData | null;
  socialData: SocialData | null;
  adversarialReport: AdversarialReport | null;
  tokenData?: TokenMarketData | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface MarketBet {
  userId: string;
  valuation: number; // in millions
  amount: number; // bet size in USD
  timestamp: string;
  xrplAddress?: string; // investor's XRPL address for equity delivery
}

export interface PortfolioData {
  userId: string;
  settlements: Array<{
    marketId: string;
    reportId: string;
    companyName: string;
    consensusValuationM: number;
    equityToken: EquityToken;
    userEscrows: ParticipantEscrow[];
    safe: { contractAddress: string; baseExplorerUrl: string } | null;
    settledAt: string;
  }>;
  activeBets: Array<{
    marketId: string;
    reportId: string;
    githubUrl: string;
    status: string;
    consensusValuation: number | null;
    userBets: MarketBet[];
  }>;
  totalEquityPositions: number;
  totalActiveBets: number;
}

export interface WalletPortfolio {
  address: string;
  xrpBalance: string;
  onChainHoldings: Array<{ mptIssuanceId: string; value: string }>;
  settlements: PortfolioData["settlements"];
  totalEquityPositions: number;
}

export interface ValuationMarket {
  id: string;
  reportId: string;
  githubUrl: string;
  status: "open" | "closed";
  bets: MarketBet[];
  consensusValuation: number | null; // weighted average in millions
  openedAt: string;
  closedAt: string | null;
  agentValuation: number | null;
  agentConfidence: number | null;
}

export interface EquityToken {
  mptIssuanceId: string;
  founderAddress: string;
  companyName: string;
  totalShares: string;
  royaltyBps: number;
  transferable: boolean;
  createdAt: number;
}

export interface VestingEscrow {
  escrowSequence: number;
  ownerAddress: string;
  beneficiaryAddress: string;
  mptIssuanceId: string;
  sharesAmount: string;
  finishAfter: number | null;
  cancelAfter: number | null;
  condition: string | null;
}

export interface ParticipantEscrow {
  userId: string;
  xrplAddress: string;
  escrow: VestingEscrow;
  sharesAllocated: string;
  condition: string;
  explorerLink: string;
}

export interface SAFEData {
  contractAddress: string;
  documentHash: string;
  deployTxHash: string;
  linkTxHash: string | null;
  settleTxHash: string | null;
  baseSepoliaExplorerUrl: string;
  documentPreview: string;
}

export interface SettlementResult {
  marketId: string;
  reportId: string;
  companyName: string;
  consensusValuationM: number;
  valuationCapXRP: string;
  equityToken: EquityToken;
  escrows: ParticipantEscrow[];
  rlusdFeeHash: string | null;
  rlusdTrustLineHash: string | null;
  settledAt: string;
  explorerLinks: string[];
  safe?: SAFEData;
}

export interface XrplStatus {
  configured: boolean;
  network: string;
  wallets: Record<string, { address: string; balanceXRP: string; balanceRLUSD: string } | { error: string }>;
  settlementCount: number;
  settlements: SettlementResult[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
