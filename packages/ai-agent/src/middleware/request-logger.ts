import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

/**
 * HTTP request logging middleware.
 * Logs method, path, status code, and response time for every request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // log after response is sent
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  });

  next();
}
