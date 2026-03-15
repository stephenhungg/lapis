import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../logger.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// attach authenticated user to request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Middleware that extracts user identity from Supabase JWT.
 * Does NOT block unauthenticated requests -- just sets req.userId if valid.
 * Use requireAuth() for endpoints that need authentication.
 */
export function extractUser() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logger.warn("Supabase not configured -- user extraction disabled");
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  return async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.slice(7);

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return next(); // invalid token, continue as unauthenticated
      }

      req.userId = user.id;
      req.userEmail = user.email;
    } catch {
      // token verification failed, continue as unauthenticated
    }

    next();
  };
}

/**
 * Middleware that requires authentication.
 * Must be used AFTER extractUser().
 */
export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }
    next();
  };
}
