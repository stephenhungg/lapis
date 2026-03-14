import type { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "@lapis/shared";

// ---------------------------------------------------------------------------
// Sliding-window in-memory rate limiter
// ---------------------------------------------------------------------------

export interface RateLimitTier {
  /** Max requests allowed within the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface ClientRecord {
  /** Timestamps (ms) of requests within the current window */
  timestamps: number[];
}

/** Map of composite key (ip + tier label) -> client record */
const clients = new Map<string, ClientRecord>();

// Auto-cleanup expired entries every 5 minutes to prevent memory leaks.
// We keep a reference so tests could clear it if needed.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of clients) {
    // Remove timestamps older than any reasonable window (use 5 min as upper bound)
    record.timestamps = record.timestamps.filter(
      (ts) => now - ts < CLEANUP_INTERVAL_MS
    );
    if (record.timestamps.length === 0) {
      clients.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Allow the Node process to exit even if the timer is still running
cleanupTimer.unref();

/**
 * Factory: creates an Express middleware that enforces a sliding-window
 * rate limit for a given tier.
 *
 * @param tierLabel  A human-readable label used to namespace the counter
 *                   (e.g. "analyze", "settle", "mutation", "read").
 * @param tier       The limit configuration.
 */
export function createRateLimiter(
  tierLabel: string,
  tier: RateLimitTier
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${ip}:${tierLabel}`;
    const now = Date.now();

    let record = clients.get(key);
    if (!record) {
      record = { timestamps: [] };
      clients.set(key, record);
    }

    // Slide the window: keep only timestamps within the current window
    record.timestamps = record.timestamps.filter(
      (ts) => now - ts < tier.windowMs
    );

    if (record.timestamps.length >= tier.maxRequests) {
      // Compute how many seconds until the oldest request in the window expires
      const oldestInWindow = record.timestamps[0];
      const retryAfterMs = tier.windowMs - (now - oldestInWindow);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      res.set("Retry-After", String(retryAfterSec));

      const body: ApiResponse<never> = {
        success: false,
        error: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
      };
      res.status(429).json(body);
      return;
    }

    // Allow the request through and record it
    record.timestamps.push(now);
    next();
  };
}
