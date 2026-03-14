import dotenv from "dotenv";
import { resolve } from "path";

// try loading .env from the ai-agent package root
dotenv.config({ path: resolve(process.cwd(), "packages/ai-agent/.env") });
// also try from cwd in case we're running from within the package
dotenv.config({ path: resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import { logger } from "./logger.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { createApiKeyMiddleware } from "./middleware/auth.js";
import { createXrplPaywallMiddleware } from "./xrpl/paywall.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { router } from "../api/routes.js";
import { getRedis } from "./redis.js";

async function main() {
  // initialize redis connection (falls back to in-memory if not configured)
  const redis = getRedis();
  if (redis) {
    logger.info("Redis configured, using persistent storage");
  } else {
    logger.info("No REDIS_URL set, using in-memory storage (state lost on restart)");
  }

  const app = express();

  // --- Core middleware ---
  app.use(cors());
  app.use(securityHeaders);
  app.use(express.json({ limit: "1mb" })); // prevent large payload abuse
  app.use(requestLogger);

  // --- Rate limiting (before auth & routes) ---
  const ONE_MINUTE = 60 * 1000;

  // POST /analyze: 5 req/min (expensive — burns Claude API credits)
  app.post(
    "/analyze",
    createRateLimiter("analyze", { maxRequests: 5, windowMs: ONE_MINUTE })
  );

  // POST /market/:id/settle: 2 req/min (XRPL transactions are slow)
  app.post(
    "/market/:id/settle",
    createRateLimiter("settle", { maxRequests: 2, windowMs: ONE_MINUTE })
  );

  // POST /market/* and POST /monitor/*: 20 req/min
  app.post(
    "/market/*",
    createRateLimiter("mutation", { maxRequests: 20, windowMs: ONE_MINUTE })
  );
  app.post(
    "/monitor/*",
    createRateLimiter("mutation", { maxRequests: 20, windowMs: ONE_MINUTE })
  );

  // GET endpoints: 60 req/min
  app.get(
    "*",
    createRateLimiter("read", { maxRequests: 60, windowMs: ONE_MINUTE })
  );

  // --- Auth & paywall ---
  app.use(createApiKeyMiddleware());
  app.use(await createXrplPaywallMiddleware());

  // --- Routes ---
  app.use(router);

  // --- Error handling (must be AFTER routes) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  // --- Graceful shutdown ---
  const PORT = process.env.PORT || 3001;

  const server = app.listen(PORT, () => {
    logger.info(`Lapis AI Agent running on http://localhost:${PORT}`);
    console.log(`\n  Analysis:`);
    console.log(`  POST /analyze             - submit a GitHub repo for analysis`);
    console.log(`  GET  /report/:id/score    - poll analysis status and scores`);
    console.log(`  GET  /report/:id          - full report card (XRPL paywalled)`);
    console.log(`\n  Prediction Market:`);
    console.log(`  POST /market/:reportId    - open market for a completed report`);
    console.log(`  POST /market/:id/bet      - place a valuation bet`);
    console.log(`  POST /market/:id/close    - close market, finalize valuation`);
    console.log(`  GET  /market/:id          - get market data`);
    console.log(`\n  Continuous Monitoring (Agentic Loop):`);
    console.log(`  POST /monitor/:reportId   - start watching a repo for changes`);
    console.log(`  DELETE /monitor/:reportId - stop watching`);
    console.log(`  GET  /monitor             - list all monitored repos`);
    console.log(`\n  XRPL Settlement:`);
    console.log(`  POST /market/:id/settle   - close market & settle on XRPL`);
    console.log(`  GET  /xrpl/status         - XRPL wallets, balances, settlements`);
    console.log(`  POST /xrpl/escrow/:id/release - release a vesting escrow`);
    console.log(`\n  GET  /health              - health check`);

    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn("ANTHROPIC_API_KEY not set. Analysis will fail.");
    }
    if (!process.env.GITHUB_TOKEN) {
      logger.warn("GITHUB_TOKEN not set. GitHub API rate limits will be low.");
    }
    if (!process.env.FOUNDER_SEED || !process.env.AGENT_SEED) {
      logger.warn("FOUNDER_SEED and/or AGENT_SEED not set. XRPL settlement will not work.");
    }
  });

  // graceful shutdown: close server + disconnect XRPL
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed");
    });
    try {
      const { disconnect } = await import("@lapis/xrpl-contracts");
      await disconnect();
      logger.info("XRPL client disconnected");
    } catch {
      // xrpl client may not have been initialized
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // catch unhandled rejections instead of crashing
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", {
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

main().catch((err) => {
  logger.error("Failed to start server", { error: err.message, stack: err.stack });
  process.exit(1);
});
