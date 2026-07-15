import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { JWT_SECRET } from "../config.js";

interface JwtPayload {
  userId: string;
  sessionId?: string;
}

const COOKIE_NAME = "planner_session";

function extractToken(req: Request): string | null {
  // Prefer cookie
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie) return cookie;

  // Fallback to Bearer header (legacy / socket.io handshake)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid token" },
    });
    return;
  }

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
