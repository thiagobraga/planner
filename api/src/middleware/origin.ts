import type { Request, Response, NextFunction } from "express";
import { CORS_ORIGIN } from "../config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ALLOWED_ORIGINS = new Set([CORS_ORIGIN]);

export function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers["origin"] as string | undefined;
  const referer = req.headers["referer"] as string | undefined;

  const contentType = req.headers["content-type"] as string | undefined;

  // Requests with a JSON content type are never simple — they must have a
  // preflight, which means a validated origin. Skip further checks.
  if (contentType && contentType.startsWith("application/json")) {
    next();
    return;
  }

  // For non-JSON unsafe requests (historically called "simple" requests that
  // browsers send without preflight), require a matching Origin.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({
      error: { code: "ORIGIN_DENIED", message: "Origin not allowed" },
    });
    return;
  }

  // When Origin is absent (e.g. <form> POST from same origin page), check
  // Referer as a weaker signal.
  if (!origin && referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!ALLOWED_ORIGINS.has(refOrigin)) {
        res.status(403).json({
          error: { code: "ORIGIN_DENIED", message: "Referer origin not allowed" },
        });
        return;
      }
    } catch {
      res.status(403).json({
        error: { code: "ORIGIN_DENIED", message: "Invalid Referer" },
      });
      return;
    }
  }

  next();
}
