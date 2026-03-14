// Input validation helpers for route handlers.
// No external dependencies -- plain string/number checks.

import type { ApiResponse } from "@lapis/shared";
import type { Response } from "express";

// ── String helpers ──────────────────────────────────────────────

/** Trim whitespace and truncate to `maxLen` characters. */
export function sanitizeString(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLen);
}

// ── Reusable patterns ───────────────────────────────────────────

const GITHUB_URL_RE =
  /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/;

const TWITTER_HANDLE_RE = /^@?[A-Za-z0-9_]{1,15}$/;

/** Alphanumeric, hyphens, and underscores. */
const USER_ID_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Route params are either:
 *   - UUIDv4  (report ids)
 *   - mkt_<hex8>  (market ids created by polymarket/market.ts)
 */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREFIXED_ID_RE = /^(mkt|rpt)_[A-Za-z0-9_-]{1,64}$/;

// ── Validation result type ──────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

// ── Field validators ────────────────────────────────────────────

export function validateGithubUrl(raw: unknown): ValidationError | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {
      field: "githubUrl",
      message: "githubUrl is required",
    };
  }
  const url = raw.trim();
  if (url.length > 500) {
    return {
      field: "githubUrl",
      message: "githubUrl must be at most 500 characters",
    };
  }
  if (!GITHUB_URL_RE.test(url)) {
    return {
      field: "githubUrl",
      message:
        "Invalid githubUrl. Expected format: https://github.com/owner/repo",
    };
  }
  return null;
}

export function validateTwitterHandle(raw: unknown): ValidationError | null {
  if (raw === undefined || raw === null || raw === "") return null; // optional
  if (typeof raw !== "string") {
    return {
      field: "twitterHandle",
      message: "twitterHandle must be a string",
    };
  }
  const handle = raw.trim();
  if (handle.length > 50) {
    return {
      field: "twitterHandle",
      message: "twitterHandle must be at most 50 characters",
    };
  }
  if (!TWITTER_HANDLE_RE.test(handle)) {
    return {
      field: "twitterHandle",
      message:
        "Invalid twitterHandle. Expected format: @handle (1-15 alphanumeric/underscore characters)",
    };
  }
  return null;
}

export function validateUserId(raw: unknown): ValidationError | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { field: "userId", message: "userId is required" };
  }
  const id = raw.trim();
  if (id.length > 100) {
    return {
      field: "userId",
      message: "userId must be at most 100 characters",
    };
  }
  if (!USER_ID_RE.test(id)) {
    return {
      field: "userId",
      message:
        "userId must contain only alphanumeric characters, hyphens, and underscores",
    };
  }
  return null;
}

export function validatePositiveNumber(
  raw: unknown,
  field: string,
  max: number
): ValidationError | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { field, message: `${field} must be a finite number` };
  }
  if (raw <= 0) {
    return { field, message: `${field} must be a positive number` };
  }
  if (raw > max) {
    return {
      field,
      message: `${field} must be at most ${max.toLocaleString()}`,
    };
  }
  return null;
}

export function validateIntervalMs(raw: unknown): ValidationError | null {
  if (raw === undefined || raw === null) return null; // optional
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { field: "intervalMs", message: "intervalMs must be a number" };
  }
  if (raw < 10_000) {
    return {
      field: "intervalMs",
      message: "intervalMs must be at least 10000 (10 seconds)",
    };
  }
  if (raw > 3_600_000) {
    return {
      field: "intervalMs",
      message: "intervalMs must be at most 3600000 (1 hour)",
    };
  }
  return null;
}

export function validateRouteId(
  raw: string,
  paramName: string
): ValidationError | null {
  if (!raw) {
    return { field: paramName, message: `${paramName} is required` };
  }
  if (!UUID_V4_RE.test(raw) && !PREFIXED_ID_RE.test(raw)) {
    return {
      field: paramName,
      message: `${paramName} must be a valid UUID or prefixed ID (e.g. mkt_abc12345)`,
    };
  }
  return null;
}

// ── Response helper ─────────────────────────────────────────────

/**
 * Send a 400 response with the first validation error.
 * Returns `true` if an error was sent (caller should return early).
 */
export function sendValidationError(
  res: Response,
  errors: (ValidationError | null)[]
): boolean {
  const first = errors.find((e) => e !== null);
  if (!first) return false;
  const body: ApiResponse<never> = {
    success: false,
    error: `Validation error on '${first.field}': ${first.message}`,
  };
  res.status(400).json(body);
  return true;
}
