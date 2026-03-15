import type {
  ReportCard,
  ReportScores,
  ValuationMarket,
  SettlementResult,
  XrplStatus,
  PortfolioData,
  WalletPortfolio,
} from "./api-types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://lapis-api-production.up.railway.app";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface PaymentDetails {
  destination: string;
  amountXRP: string;
  network: string;
  instructions: string;
  headers?: Record<string, string>;
}

class PaywallError extends ApiError {
  paymentDetails: PaymentDetails;
  constructor(message: string, paymentDetails: PaymentDetails) {
    super(message, 402);
    this.name = "PaywallError";
    this.paymentDetails = paymentDetails;
  }
}

function getWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lapis_xrpl_wallet") || null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const wallet = getWalletAddress();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(wallet ? { "X-Wallet-Address": wallet } : {}),
    ...(options?.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!json.success) {
    if (res.status === 402 && json.paymentDetails) {
      throw new PaywallError(json.error || "Payment required", json.paymentDetails);
    }
    throw new ApiError(json.error || "API error", res.status);
  }

  return json.data as T;
}

// ==========================================
// ANALYSIS
// ==========================================

export async function analyze(
  githubUrl: string,
  twitterHandle?: string,
  tokenAddress?: string,
  tokenChain?: string
): Promise<{ id: string; status: string }> {
  return request("/analyze", {
    method: "POST",
    body: JSON.stringify({ githubUrl, twitterHandle, tokenAddress, tokenChain }),
  });
}

export async function pollScore(
  reportId: string
): Promise<{
  id: string;
  status: string;
  scores: ReportScores | null;
  error: string | null;
}> {
  return request(`/report/${reportId}/score`);
}

export async function getReport(reportId: string): Promise<ReportCard> {
  return request(`/report/${reportId}`);
}

export async function getReportWithPayment(
  reportId: string,
  txHash: string
): Promise<ReportCard> {
  return request(`/report/${reportId}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Payment-TxHash": txHash,
    },
  });
}

// ==========================================
// MARKETS
// ==========================================

export async function createMarket(
  reportId: string
): Promise<ValuationMarket> {
  return request(`/market/${reportId}`, { method: "POST" });
}

export async function getMarket(marketId: string): Promise<ValuationMarket> {
  return request(`/market/${marketId}`);
}

export async function getMarkets(): Promise<ValuationMarket[]> {
  return request(`/markets`);
}

export async function placeBet(
  marketId: string,
  userId: string,
  valuation: number,
  amount: number,
  xrplAddress?: string
): Promise<ValuationMarket> {
  return request(`/market/${marketId}/bet`, {
    method: "POST",
    body: JSON.stringify({ userId, valuation, amount, ...(xrplAddress ? { xrplAddress } : {}) }),
  });
}

export async function closeMarket(
  marketId: string
): Promise<ValuationMarket> {
  return request(`/market/${marketId}/close`, { method: "POST" });
}

// ==========================================
// SETTLEMENT
// ==========================================

export async function settleMarket(
  marketId: string
): Promise<SettlementResult> {
  return request(`/market/${marketId}/settle`, { method: "POST" });
}

export async function getXrplStatus(): Promise<XrplStatus> {
  return request("/xrpl/status");
}

export interface SAFEStatus {
  contractAddress: string;
  documentHash: string;
  deployTxHash: string;
  linkTxHash: string | null;
  settleTxHash: string | null;
  baseSepoliaExplorerUrl: string;
  documentPreview: string;
  onChainStatus?: {
    status: string;
    mptIssuanceId: string;
    documentHash: string;
  };
  xrplMptIssuanceId?: string;
  crossChainVerified?: boolean;
}

export async function getSafe(marketId: string): Promise<SAFEStatus> {
  return request(`/safe/${marketId}`);
}

// ==========================================
// PORTFOLIO
// ==========================================

export async function getPortfolio(userId: string): Promise<PortfolioData> {
  return request(`/portfolio/${userId}`);
}

export async function getWalletPortfolio(address: string): Promise<WalletPortfolio> {
  return request(`/portfolio/wallet/${address}`);
}

// ==========================================
// MONITORING
// ==========================================

export async function startMonitoring(
  reportId: string,
  intervalMs?: number
): Promise<{ reportId: string; githubUrl: string; intervalMs: number; message: string }> {
  return request(`/monitor/${reportId}`, {
    method: "POST",
    body: JSON.stringify({ intervalMs }),
  });
}

// ==========================================
// HEALTH
// ==========================================

export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  return request("/health");
}

// ==========================================
// UTILS
// ==========================================

/** Get or create a stable anonymous user ID for betting */
/** Get user identity -- wallet address if connected, fallback to anonymous UUID */
export function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  // prefer wallet address as identity
  const wallet = getWalletAddress();
  if (wallet) return wallet;
  // fallback to anonymous UUID for users who haven't connected wallet
  let id = localStorage.getItem("lapis_user_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lapis_user_id", id);
  }
  return id;
}

export { ApiError, PaywallError };
