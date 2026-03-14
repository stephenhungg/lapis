import dotenv from "dotenv";
import { resolve } from "path";

// try loading .env from the ai-agent package root
dotenv.config({ path: resolve(process.cwd(), "packages/ai-agent/.env") });
// also try from cwd in case we're running from within the package
dotenv.config({ path: resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import { createXrplPaywallMiddleware } from "./xrpl/paywall.js";
import { router } from "../api/routes.js";
import { getRedis } from "./redis.js";

async function main() {
  // initialize redis connection (falls back to in-memory if not configured)
  const redis = getRedis();
  if (redis) {
    console.log("Redis configured, using persistent storage");
  } else {
    console.log("No REDIS_URL set, using in-memory storage (state lost on restart)");
  }

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(await createXrplPaywallMiddleware());
  app.use(router);

  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log(`Lapis AI Agent running on http://localhost:${PORT}`);
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
      console.warn("\n  WARNING: ANTHROPIC_API_KEY not set. Analysis will fail.");
      console.warn("  Copy .env.example to .env and add your key.\n");
    }
    if (!process.env.GITHUB_TOKEN) {
      console.warn("  WARNING: GITHUB_TOKEN not set. GitHub API rate limits will be low.\n");
    }
    if (!process.env.FOUNDER_SEED || !process.env.AGENT_SEED) {
      console.warn("  WARNING: FOUNDER_SEED and/or AGENT_SEED not set. XRPL settlement will not work.");
      console.warn("  Generate testnet wallets and add seeds to .env\n");
    }
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
