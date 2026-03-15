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
  getAllMarkets,
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
import {
  sanitizeString,
  validateGithubUrl,
  validateTwitterHandle,
  validateTokenAddress,
  validateTokenChain,
  validateUserId,
  validatePositiveNumber,
  validateIntervalMs,
  validateRouteId,
  sendValidationError,
} from "../src/middleware/validate.js";

// sanitize settlement data for API responses (fulfillments are stored separately, not in the type)
function sanitizeSettlement(s: SettlementResult): SettlementResult {
  return { ...s };
}

export const router = Router();

// ==========================================
// ANALYSIS ROUTES
// ==========================================

// POST /analyze - submit a repo for analysis
router.post("/analyze", async (req, res) => {
  const {
    githubUrl: rawUrl,
    twitterHandle: rawHandle,
    tokenAddress: rawTokenAddress,
    tokenChain: rawTokenChain,
  } = req.body as AnalyzeRequest;

  if (
    sendValidationError(res, [
      validateGithubUrl(rawUrl),
      validateTwitterHandle(rawHandle),
      validateTokenAddress(rawTokenAddress),
      validateTokenChain(rawTokenChain),
    ])
  )
    return;

  const githubUrl = sanitizeString(rawUrl, 500);
  const twitterHandle = rawHandle
    ? sanitizeString(rawHandle, 50)
    : undefined;
  const tokenAddress = rawTokenAddress
    ? sanitizeString(rawTokenAddress, 200)
    : undefined;
  const tokenChain = rawTokenChain
    ? sanitizeString(rawTokenChain, 50)
    : undefined;

  const report = await createReport(githubUrl);

  // fire and forget - don't await
  runAnalysisPipeline(report.id, githubUrl, twitterHandle, tokenAddress, tokenChain);

  const response: ApiResponse<{ id: string; status: string }> = {
    success: true,
    data: { id: report.id, status: report.status },
  };
  res.status(201).json(response);
});

// GET /report/:id/score - free endpoint for polling status + scores
router.get("/report/:id/score", async (req, res) => {
  if (sendValidationError(res, [validateRouteId(req.params.id, "id")])) return;

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
  if (sendValidationError(res, [validateRouteId(req.params.id, "id")])) return;

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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.reportId, "reportId"),
    ])
  )
    return;

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
  const { userId: rawUserId, valuation, amount, xrplAddress } = req.body as {
    userId: string;
    valuation: number;
    amount: number;
    xrplAddress?: string;
  };

  if (
    sendValidationError(res, [
      validateRouteId(req.params.marketId, "marketId"),
      validateUserId(rawUserId),
      validatePositiveNumber(valuation, "valuation", 1_000_000),
      validatePositiveNumber(amount, "amount", 1_000_000),
    ])
  )
    return;

  // validate XRPL address format if provided
  if (xrplAddress && !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(xrplAddress)) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Invalid XRPL address format (must start with 'r')",
    };
    res.status(400).json(response);
    return;
  }

  const userId = sanitizeString(rawUserId, 100);

  try {
    const market = await placeBet(req.params.marketId, userId, valuation, amount, xrplAddress);
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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.marketId, "marketId"),
    ])
  )
    return;

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

// GET /markets - list all markets
router.get("/markets", async (_req, res) => {
  try {
    const markets = await getAllMarkets();
    const response: ApiResponse<ValuationMarket[]> = {
      success: true,
      data: markets,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /market/:marketId - get market data
router.get("/market/:marketId", async (req, res) => {
  if (
    sendValidationError(res, [
      validateRouteId(req.params.marketId, "marketId"),
    ])
  )
    return;

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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.reportId, "reportId"),
      validateIntervalMs(req.body?.intervalMs),
    ])
  )
    return;

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

  const intervalMs = req.body?.intervalMs ?? 30_000;
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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.reportId, "reportId"),
    ])
  )
    return;

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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.reportId, "reportId"),
    ])
  )
    return;

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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.marketId, "marketId"),
    ])
  )
    return;

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

  // close the market if still open, then re-fetch to get closed state
  if (market.status === "open") {
    await closeMarket(market.id);
  }
  const settleMarketData = (await getMarketById(req.params.marketId))!;

  if (!settleMarketData.consensusValuation) {
    const response: ApiResponse<never> = {
      success: false,
      error: "Market has no consensus valuation (no bets placed)",
    };
    res.status(400).json(response);
    return;
  }

  const report = await getReport(settleMarketData.reportId);
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
    const settlement = await settleMarket(settleMarketData, report);
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
  if (
    sendValidationError(res, [
      validateRouteId(req.params.marketId, "marketId"),
    ])
  )
    return;

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

  const { userId: rawUserId } = req.body as { userId: string };

  if (sendValidationError(res, [validateUserId(rawUserId)])) return;

  const userId = sanitizeString(rawUserId, 100);

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
// PORTFOLIO (investor observability)
// ==========================================

// GET /portfolio/:userId - get all equity positions for a user
router.get("/portfolio/:userId", async (req, res) => {
  const userId = req.params.userId;
  const allSettlements = await getAllSettlements();
  const allMarkets = await getAllMarkets();

  // find settlements where this user has escrows
  const userSettlements = allSettlements
    .filter((s) => s.escrows.some((e) => e.userId === userId))
    .map((s) => ({
      marketId: s.marketId,
      reportId: s.reportId,
      companyName: s.companyName,
      consensusValuationM: s.consensusValuationM,
      equityToken: s.equityToken,
      userEscrows: s.escrows.filter((e) => e.userId === userId),
      safe: s.safe
        ? {
            contractAddress: s.safe.contractAddress,
            baseExplorerUrl: s.safe.baseSepoliaExplorerUrl,
          }
        : null,
      settledAt: s.settledAt,
    }));

  // find all bets by this user across markets
  const userBets = allMarkets
    .filter((m) => m.bets.some((b) => b.userId === userId))
    .map((m) => ({
      marketId: m.id,
      reportId: m.reportId,
      githubUrl: m.githubUrl,
      status: m.status,
      consensusValuation: m.consensusValuation,
      userBets: m.bets.filter((b) => b.userId === userId),
    }));

  res.json({
    success: true,
    data: {
      userId,
      settlements: userSettlements,
      activeBets: userBets,
      totalEquityPositions: userSettlements.length,
      totalActiveBets: userBets.reduce((sum, m) => sum + m.userBets.length, 0),
    },
  });
});

// GET /portfolio/wallet/:address - get equity positions by XRPL address
router.get("/portfolio/wallet/:address", async (req, res) => {
  const address = req.params.address;

  // validate XRPL address format
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
    res.status(400).json({ success: false, error: "Invalid XRPL address" });
    return;
  }

  const allSettlements = await getAllSettlements();

  // find settlements where this address has escrows
  const userSettlements = allSettlements
    .filter((s) => s.escrows.some((e) => e.xrplAddress === address))
    .map((s) => ({
      marketId: s.marketId,
      reportId: s.reportId,
      companyName: s.companyName,
      consensusValuationM: s.consensusValuationM,
      equityToken: s.equityToken,
      userEscrows: s.escrows.filter((e) => e.xrplAddress === address),
      safe: s.safe
        ? {
            contractAddress: s.safe.contractAddress,
            baseExplorerUrl: s.safe.baseSepoliaExplorerUrl,
          }
        : null,
      settledAt: s.settledAt,
    }));

  // try on-chain holdings query (non-critical)
  let onChainHoldings: Array<{ mptIssuanceId: string; value: string }> = [];
  let xrpBalance = "0";
  try {
    const { getMptHoldings, getBalance } = await import("@lapis/xrpl-contracts");
    onChainHoldings = await getMptHoldings(address);
    xrpBalance = await getBalance(address);
  } catch {
    // XRPL query failed, continue with off-chain data
  }

  res.json({
    success: true,
    data: {
      address,
      xrpBalance,
      onChainHoldings,
      settlements: userSettlements,
      totalEquityPositions: userSettlements.length,
    },
  });
});

// ==========================================
// METALEX SAFE
// ==========================================

router.get("/safe/:marketId", async (req, res) => {
  if (
    sendValidationError(res, [
      validateRouteId(req.params.marketId, "marketId"),
    ])
  )
    return;

  const settlement = await getSettlement(req.params.marketId);
  if (!settlement) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Settlement not found",
    };
    res.status(404).json(response);
    return;
  }

  if (!settlement.safe) {
    const response: ApiResponse<null> = {
      success: false,
      error: "No SAFE agreement for this settlement (BASE_PRIVATE_KEY may not have been set)",
    };
    res.status(404).json(response);
    return;
  }

  try {
    // try to read live on-chain status from Base
    const { readSAFEStatus } = await import("@lapis/metalex");
    const onChainStatus = await readSAFEStatus(
      settlement.safe.contractAddress as `0x${string}`
    );

    const statusLabels = ["Proposed", "Confirmed", "Settled", "Voided"];

    res.json({
      success: true,
      data: {
        ...settlement.safe,
        onChainStatus: {
          status: statusLabels[onChainStatus.status] ?? "Unknown",
          mptIssuanceId: onChainStatus.mptIssuanceId,
          documentHash: onChainStatus.documentHash,
        },
        xrplMptIssuanceId: settlement.equityToken.mptIssuanceId,
        crossChainVerified:
          onChainStatus.mptIssuanceId ===
          settlement.equityToken.mptIssuanceId,
      },
    });
  } catch {
    // fallback if Base is unreachable
    res.json({ success: true, data: settlement.safe });
  }
});

// ==========================================
// HEALTH
// ==========================================

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
