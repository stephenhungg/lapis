import crypto from "node:crypto";
import { Router } from "express";
import type { AnalyzeRequest, ApiResponse, ReportCard } from "@lapis/shared";
import {
  walletFromEnv,
  getBalance,
  releaseEscrow,
} from "@lapis/xrpl-contracts";
import { createReport, getReport } from "../src/store.js";
import { runAnalysisPipeline } from "../src/pipeline.js";
import {
  startMonitoring,
  stopMonitoring,
  getMonitoredRepos,
  isMonitoring,
} from "../src/monitor.js";
import {
  createMarket,
  placeBet,
  closeMarket,
  getMarketById,
  getMarketByReport,
  estimateValuation,
} from "../src/polymarket/index.js";
import type { ValuationMarket } from "../src/polymarket/index.js";
import {
  settleMarket,
  getSettlement,
  getAllSettlements,
  getFulfillment,
} from "../src/xrpl/index.js";
import type { SettlementResult } from "../src/xrpl/index.js";
import { getRlusdBalance } from "../src/xrpl/rlusd.js";

// sanitize settlement data for API responses (fulfillments are stored separately, not in the type)
function sanitizeSettlement(s: SettlementResult): SettlementResult {
  return { ...s };
}

export const router = Router();

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/;

// ==========================================
// ANALYSIS ROUTES
// ==========================================

// POST /analyze - submit a repo for analysis
router.post("/analyze", (req, res) => {
  const { githubUrl, twitterHandle } = req.body as AnalyzeRequest;

  if (!githubUrl || !GITHUB_URL_REGEX.test(githubUrl)) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Invalid or missing githubUrl. Expected: https://github.com/owner/repo",
    };
    res.status(400).json(response);
    return;
  }

  const report = createReport(githubUrl);

  // fire and forget - don't await
  runAnalysisPipeline(report.id, githubUrl, twitterHandle);

  const response: ApiResponse<{ id: string; status: string }> = {
    success: true,
    data: { id: report.id, status: report.status },
  };
  res.status(201).json(response);
});

// GET /report/:id/score - free endpoint for polling status + scores
router.get("/report/:id/score", async (req, res) => {
  const report = await getReport(req.params.id);

  if (!report) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report not found",
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse<{
    id: string;
    status: string;
    scores: ReportCard["scores"];
    error: string | null;
  }> = {
    success: true,
    data: {
      id: report.id,
      status: report.status,
      scores: report.scores,
      error: report.error,
    },
  };
  res.json(response);
});

// GET /report/:id - full report (behind XRPL paywall)
router.get("/report/:id", async (req, res) => {
  const report = await getReport(req.params.id);

  if (!report) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report not found",
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse<ReportCard> = {
    success: true,
    data: report,
  };
  res.json(response);
});

// ==========================================
// PREDICTION MARKET ROUTES
// ==========================================

// POST /market/:reportId - open a prediction market for a completed report
router.post("/market/:reportId", async (req, res) => {
  const report = await getReport(req.params.reportId);

  if (!report) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report not found",
    };
    res.status(404).json(response);
    return;
  }

  if (report.status !== "complete" || !report.scores) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report must be complete before opening a market",
    };
    res.status(400).json(response);
    return;
  }

  // check if market already exists
  const existing = await getMarketByReport(report.id);
  if (existing) {
    const response: ApiResponse<ValuationMarket> = {
      success: true,
      data: existing,
    };
    res.json(response);
    return;
  }

  // agent seeds the market with its own valuation estimate
  const { valuation, confidence } = estimateValuation(report.scores.overall);
  const market = await createMarket(report.id, report.githubUrl, valuation, confidence);

  console.log(
    `Market ${market.id} opened for ${report.githubUrl}. Agent seed: $${valuation}M (confidence: ${confidence})`
  );

  const response: ApiResponse<ValuationMarket> = {
    success: true,
    data: market,
  };
  res.status(201).json(response);
});

// POST /market/:marketId/bet - place a bet on a market
router.post("/market/:marketId/bet", async (req, res) => {
  const { userId, valuation, amount } = req.body as {
    userId: string;
    valuation: number;
    amount: number;
  };

  if (
    !userId ||
    typeof valuation !== "number" || valuation <= 0 ||
    typeof amount !== "number" || amount <= 0
  ) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Invalid input. Required: userId (string), valuation (positive number, in millions), amount (positive number, in USD)",
    };
    res.status(400).json(response);
    return;
  }

  try {
    const market = await placeBet(req.params.marketId, userId, valuation, amount);
    const response: ApiResponse<ValuationMarket> = {
      success: true,
      data: market,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(400).json(response);
  }
});

// POST /market/:marketId/close - close a market and finalize valuation
router.post("/market/:marketId/close", async (req, res) => {
  try {
    const market = await closeMarket(req.params.marketId);
    const response: ApiResponse<ValuationMarket> = {
      success: true,
      data: market,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(400).json(response);
  }
});

// GET /market/:marketId - get market data
router.get("/market/:marketId", async (req, res) => {
  const market = await getMarketById(req.params.marketId);

  if (!market) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Market not found",
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse<ValuationMarket> = {
    success: true,
    data: market,
  };
  res.json(response);
});

// ==========================================
// MONITORING ROUTES (agentic loop)
// ==========================================

// POST /monitor/:reportId - start continuously monitoring a repo
router.post("/monitor/:reportId", async (req, res) => {
  const report = await getReport(req.params.reportId);

  if (!report) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report not found",
    };
    res.status(404).json(response);
    return;
  }

  if (report.status !== "complete") {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report must be complete before monitoring",
    };
    res.status(400).json(response);
    return;
  }

  const intervalMs = Math.max(10_000, req.body?.intervalMs ?? 30_000);
  const entry = await startMonitoring(report.id, report.githubUrl, intervalMs);

  const response: ApiResponse<{
    reportId: string;
    githubUrl: string;
    intervalMs: number;
    message: string;
  }> = {
    success: true,
    data: {
      reportId: entry.reportId,
      githubUrl: entry.githubUrl,
      intervalMs: entry.intervalMs,
      message: `Agent is now watching ${report.githubUrl} every ${intervalMs / 1000}s. Scores and market positions will auto-update on changes.`,
    },
  };
  res.status(201).json(response);
});

// DELETE /monitor/:reportId - stop monitoring a repo
router.delete("/monitor/:reportId", (req, res) => {
  const stopped = stopMonitoring(req.params.reportId);

  if (!stopped) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Report is not being monitored",
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: "Monitoring stopped" },
  };
  res.json(response);
});

// GET /monitor - list all monitored repos
router.get("/monitor", (_req, res) => {
  const repos = getMonitoredRepos();
  const response: ApiResponse<typeof repos> = {
    success: true,
    data: repos,
  };
  res.json(response);
});

// GET /monitor/:reportId - check if a repo is being monitored
router.get("/monitor/:reportId", (req, res) => {
  const response: ApiResponse<{ monitoring: boolean }> = {
    success: true,
    data: { monitoring: isMonitoring(req.params.reportId) },
  };
  res.json(response);
});

// ==========================================
// XRPL SETTLEMENT ROUTES
// ==========================================

// POST /market/:marketId/settle - close market AND settle on XRPL
// This is the money route: issues MPT, creates escrows, pays RLUSD fee
router.post("/market/:marketId/settle", async (req, res) => {
  // idempotency: return existing settlement if already settled
  const existingSettlement = await getSettlement(req.params.marketId);
  if (existingSettlement) {
    res.json({ success: true, data: sanitizeSettlement(existingSettlement) });
    return;
  }

  const market = await getMarketById(req.params.marketId);

  if (!market) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Market not found",
    };
    res.status(404).json(response);
    return;
  }

  // close the market if still open
  if (market.status === "open") {
    await closeMarket(market.id);
  }

  if (!market.consensusValuation) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Market has no consensus valuation (no bets placed)",
    };
    res.status(400).json(response);
    return;
  }

  const report = await getReport(market.reportId);
  if (!report || report.status !== "complete" || !report.scores) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Associated report is not complete",
    };
    res.status(400).json(response);
    return;
  }

  // check env vars
  if (!process.env.FOUNDER_SEED || !process.env.AGENT_SEED) {
    const response: ApiResponse<never> = {
      success: false,
      error: "FOUNDER_SEED and AGENT_SEED must be set in .env for XRPL settlement",
    };
    res.status(500).json(response);
    return;
  }

  try {
    // ignore user-supplied config to prevent abuse (division by zero, wallet drain, etc)
    const settlement = await settleMarket(market, report);
    res.json({ success: true, data: sanitizeSettlement(settlement) });
  } catch (err) {
    const response: ApiResponse<never> = {
      success: false,
      error: `Settlement failed: ${(err as Error).message}`,
    };
    res.status(500).json(response);
  }
});

// GET /xrpl/status - XRPL connection status, wallets, settlements
router.get("/xrpl/status", async (_req, res) => {
  try {
    const hasFounder = !!process.env.FOUNDER_SEED;
    const hasAgent = !!process.env.AGENT_SEED;

    let wallets: Record<string, unknown> = {};

    if (hasFounder) {
      try {
        const fw = walletFromEnv("FOUNDER");
        const balXRP = await getBalance(fw.address);
        const balRLUSD = await getRlusdBalance(fw.address).catch(() => "0");
        wallets = {
          ...wallets,
          founder: { address: fw.address, balanceXRP: balXRP, balanceRLUSD: balRLUSD },
        };
      } catch {
        wallets = { ...wallets, founder: { error: "failed to load" } };
      }
    }

    if (hasAgent) {
      try {
        const aw = walletFromEnv("AGENT");
        const balXRP = await getBalance(aw.address);
        const balRLUSD = await getRlusdBalance(aw.address).catch(() => "0");
        wallets = {
          ...wallets,
          agent: { address: aw.address, balanceXRP: balXRP, balanceRLUSD: balRLUSD },
        };
      } catch {
        wallets = { ...wallets, agent: { error: "failed to load" } };
      }
    }

    const settlements = await getAllSettlements();

    const response: ApiResponse<{
      configured: boolean;
      network: string;
      wallets: Record<string, unknown>;
      settlementCount: number;
      settlements: SettlementResult[];
    }> = {
      success: true,
      data: {
        configured: hasFounder && hasAgent,
        network: process.env.XRPL_NETWORK || "testnet",
        wallets,
        settlementCount: settlements.length,
        settlements: settlements.map(sanitizeSettlement),
      },
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = {
      success: false,
      error: `XRPL status check failed: ${(err as Error).message}`,
    };
    res.status(500).json(response);
  }
});

// POST /xrpl/escrow/:marketId/release - agent releases a participant's escrow
router.post("/xrpl/escrow/:marketId/release", async (req, res) => {
  // auth check: require AGENT_API_SECRET as bearer token (NOT the wallet seed)
  const apiSecret = process.env.AGENT_API_SECRET;
  const authHeader = req.headers.authorization;
  if (!apiSecret) {
    res.status(500).json({ success: false, error: "AGENT_API_SECRET not configured" });
    return;
  }
  const provided = authHeader?.replace("Bearer ", "") ?? "";
  const expected = apiSecret;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const { userId } = req.body as { userId: string };

  if (!userId) {
    const response: ApiResponse<never> = {
      success: false,
      error: "userId is required",
    };
    res.status(400).json(response);
    return;
  }

  const settlement = await getSettlement(req.params.marketId);
  if (!settlement) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Settlement not found for this market",
    };
    res.status(404).json(response);
    return;
  }

  const participant = settlement.escrows.find((e) => e.userId === userId);
  if (!participant) {
    const response: ApiResponse<never> = {
      success: false,
      error: `No escrow found for user: ${userId}`,
    };
    res.status(404).json(response);
    return;
  }

  try {
    const agentWallet = walletFromEnv("AGENT");
    const fulfillment = await getFulfillment(
      participant.escrow.ownerAddress,
      participant.escrow.escrowSequence
    );

    if (!fulfillment) {
      const response: ApiResponse<never> = {
        success: false,
        error: "Fulfillment not found (cannot release without crypto-condition fulfillment)",
      };
      res.status(500).json(response);
      return;
    }

    const txHash = await releaseEscrow(agentWallet, participant.escrow, fulfillment);

    const response: ApiResponse<{
      txHash: string;
      userId: string;
      sharesReleased: string;
      beneficiary: string;
    }> = {
      success: true,
      data: {
        txHash,
        userId,
        sharesReleased: participant.sharesAllocated,
        beneficiary: participant.xrplAddress,
      },
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = {
      success: false,
      error: `Escrow release failed: ${(err as Error).message}`,
    };
    res.status(500).json(response);
  }
});

// ==========================================
// HEALTH
// ==========================================

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
