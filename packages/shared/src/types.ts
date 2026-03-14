// === Input ===
export interface AnalyzeRequest {
  githubUrl: string;
  twitterHandle?: string;
}

// === Scraped data ===
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

export interface SocialData {
  platform: "twitter";
  handle: string;
  followers: number;
  recentPostCount: number;
  avgEngagement: number;
}

// === Adversarial audit ===
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

// === Analysis output ===
export interface ReportScores {
  codeQuality: number;
  teamStrength: number;
  traction: number;
  socialPresence: number;
  overall: number;
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
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

// === API responses ===
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
