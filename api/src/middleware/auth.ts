import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

interface JwtPayload {
  userId: string;
  sessionId?: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid token" },
    });
    return;
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Token expired or invalid" },
    });
    return;
  }

  if (!payload.userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid token payload" },
    });
    return;
  }

  // Check session exists and not expired
  if (payload.sessionId) {
    const result = await pool.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()",
      [payload.sessionId, payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Session expired or revoked" },
      });
      return;
    }

    req.sessionId = payload.sessionId;
  }

  req.userId = payload.userId;
  next();
}
