import { Router } from "express";
import type { AnalyzeRequest, ApiResponse, ReportCard } from "@publicround/shared";
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
router.get("/report/:id/score", (req, res) => {
  const report = getReport(req.params.id);

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

// GET /report/:id - full report (behind x402 paywall)
router.get("/report/:id", (req, res) => {
  const report = getReport(req.params.id);

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
router.post("/market/:reportId", (req, res) => {
  const report = getReport(req.params.reportId);

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
  const existing = getMarketByReport(report.id);
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
  const market = createMarket(report.id, report.githubUrl, valuation, confidence);

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
router.post("/market/:marketId/bet", (req, res) => {
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
    const market = placeBet(req.params.marketId, userId, valuation, amount);
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
router.post("/market/:marketId/close", (req, res) => {
  try {
    const market = closeMarket(req.params.marketId);
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
router.get("/market/:marketId", (req, res) => {
  const market = getMarketById(req.params.marketId);

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
router.post("/monitor/:reportId", (req, res) => {
  const report = getReport(req.params.reportId);

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
  const entry = startMonitoring(report.id, report.githubUrl, intervalMs);

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
// HEALTH
// ==========================================

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
