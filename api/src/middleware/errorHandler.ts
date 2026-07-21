import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import crypto from "node:crypto";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = crypto.randomUUID();

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  if ("type" in err && err.type === "entity.too.large") {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds maximum size",
      },
    });
    return;
  }

  console.error(`[${requestId}] Unhandled error:`, err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  });
}
