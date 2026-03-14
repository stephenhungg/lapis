import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "@lapis/shared";

type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const passthrough: ExpressMiddleware = (_req, _res, next) => next();

/**
 * Parse the API_KEYS env var into a Set of valid keys.
 * Returns null if API_KEYS is not set or empty (auth disabled).
 */
function loadApiKeys(): Set<string> | null {
  const raw = process.env.API_KEYS;
  if (!raw || raw.trim() === "") return null;

  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  return keys.length > 0 ? new Set(keys) : null;
}

/**
 * Timing-safe check of a provided key against all valid keys.
 * Returns true if the provided key matches any key in the set.
 */
function isValidKey(provided: string, validKeys: Set<string>): boolean {
  const providedBuf = Buffer.from(provided);

  for (const key of validKeys) {
    const keyBuf = Buffer.from(key);
    if (
      providedBuf.length === keyBuf.length &&
      crypto.timingSafeEqual(providedBuf, keyBuf)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract API key from request headers.
 * Supports two formats:
 *   - X-API-Key: <key>
 *   - Authorization: Bearer <key>
 */
function extractApiKey(req: Request): string | null {
  // prefer X-API-Key header
  const xApiKey = req.headers["x-api-key"];
  if (typeof xApiKey === "string" && xApiKey.length > 0) {
    return xApiKey;
  }

  // fall back to Authorization: Bearer <key>
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }

  return null;
}

/**
 * Routes that require API key authentication.
 * Only mutation endpoints (POST/DELETE) are protected.
 * GET endpoints and the escrow release route (which has its own auth) are excluded.
 */
const PROTECTED_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/analyze$/ },
  { method: "POST", pattern: /^\/market\/[^/]+$/ },
  { method: "POST", pattern: /^\/market\/[^/]+\/bet$/ },
  { method: "POST", pattern: /^\/market\/[^/]+\/close$/ },
  { method: "POST", pattern: /^\/market\/[^/]+\/settle$/ },
  { method: "POST", pattern: /^\/monitor\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/monitor\/[^/]+$/ },
];

/**
 * API key authentication middleware.
 *
 * If API_KEYS env var is not set, auth is disabled (passthrough) -- same
 * pattern as the XRPL paywall middleware. When enabled, mutation endpoints
 * require a valid API key via X-API-Key header or Authorization: Bearer header.
 */
export function createApiKeyMiddleware(): ExpressMiddleware {
  const validKeys = loadApiKeys();

  if (!validKeys) {
    console.warn("  API key auth: disabled (API_KEYS not set)\n");
    return passthrough;
  }

  console.log(`  API key auth: active (${validKeys.size} key${validKeys.size === 1 ? "" : "s"} loaded)`);

  return ((req: Request, res: Response, next: NextFunction) => {
    // only check protected routes
    const isProtected = PROTECTED_ROUTES.some(
      (r) => req.method === r.method && r.pattern.test(req.path)
    );
    if (!isProtected) return next();

    const providedKey = extractApiKey(req);

    if (!providedKey) {
      const response: ApiResponse<never> = {
        success: false,
        error: "Missing API key. Provide via X-API-Key header or Authorization: Bearer header.",
      };
      res.status(401).json(response);
      return;
    }

    if (!isValidKey(providedKey, validKeys)) {
      const response: ApiResponse<never> = {
        success: false,
        error: "Invalid API key.",
      };
      res.status(401).json(response);
      return;
    }

    next();
  }) as ExpressMiddleware;
}
