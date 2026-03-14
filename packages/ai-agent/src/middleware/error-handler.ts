import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

/**
 * Global error handler. Catches unhandled errors from route handlers
 * and returns a structured ApiResponse error.
 *
 * Must be registered AFTER all routes (Express 4 error handler signature).
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error("Unhandled error", {
    error: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  // don't leak internal error details in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  res.status(500).json({
    success: false,
    error: message,
  });
}

/**
 * Catch-all 404 handler for unknown routes.
 * Register AFTER all routes but BEFORE error handler.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: "Not found",
  });
}
