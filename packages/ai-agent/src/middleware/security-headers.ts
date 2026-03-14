import type { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware.
 * Sets basic security headers on all responses — no dependencies needed.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // enable XSS filter in older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // don't send referrer on downgrade
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // restrict what the API can load (it's a JSON API, it shouldn't load anything)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'"
  );

  // don't expose server version
  res.removeHeader("X-Powered-By");

  next();
}
