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
// paywall disabled for hackathon demo
// import { createXrplPaywallMiddleware } from "./xrpl/paywall.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { extractUser } from "./middleware/supabase-auth.js";
import { router } from "../api/routes.js";
import { getRedis } from "./redis.js";

function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const required = ["ANTHROPIC_API_KEY", "GITHUB_TOKEN"];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    const msg = `Missing required env vars: ${missing.join(", ")}`;
    if (isProd) {
      logger.error(msg);
      process.exit(1);
    } else {
      logger.warn(msg);
    }
  }

  if (isProd && !process.env.REDIS_URL) {
    logger.error("REDIS_URL is required in production (in-memory storage will lose data on restart)");
    process.exit(1);
  }

  if (isProd && !process.env.ALLOWED_ORIGINS) {
    logger.warn("ALLOWED_ORIGINS not set in production -- CORS is wide open");
  }
}

async function main() {
  validateEnv();

  // initialize redis connection (falls back to in-memory if not configured)
  const redis = getRedis();
  if (redis) {
    logger.info("Redis configured, using persistent storage");
  } else {
    logger.info("No REDIS_URL set, using in-memory storage (state lost on restart)");
  }

  const app = express();

  // --- Core middleware ---
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : undefined; // undefined = allow all (dev mode)

  app.use(
    cors(
      allowedOrigins
        ? {
            origin: allowedOrigins,
            credentials: true,
          }
        : undefined
    )
  );
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

  // --- Auth ---
  app.use(extractUser()); // extract user from Supabase JWT (non-blocking)
  app.use(createApiKeyMiddleware()); // API key auth for service-to-service

  // --- Routes ---
  app.use(router);

  // --- Error handling (must be AFTER routes) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  // --- Graceful shutdown ---
  const PORT = process.env.PORT || 3001;

  const server = app.listen(PORT, () => {
    logger.info(`Lapis AI Agent running on port ${PORT}`, {
      port: PORT,
      env: process.env.NODE_ENV || "development",
      redis: !!redis,
      cors: allowedOrigins ? allowedOrigins.join(", ") : "open",
    });

    if (!process.env.FOUNDER_SEED || !process.env.AGENT_SEED) {
      logger.warn("FOUNDER_SEED and/or AGENT_SEED not set -- XRPL settlement disabled");
    }
    if (!process.env.BASE_PRIVATE_KEY) {
      logger.warn("BASE_PRIVATE_KEY not set -- SAFE deployment on Base disabled");
    }
    if (!process.env.XAI_API_KEY) {
      logger.warn("XAI_API_KEY not set -- social scraper disabled");
    }
  });

  // graceful shutdown: stop monitors, close server, disconnect XRPL
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    // stop all background monitors
    try {
      const { stopAllMonitors } = await import("./monitor.js");
      stopAllMonitors();
      logger.info("Background monitors stopped");
    } catch {
      // monitors may not have been started
    }

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
