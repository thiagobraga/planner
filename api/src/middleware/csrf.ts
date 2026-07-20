import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { CSRF_SECRET, IS_PRODUCTION } from "../config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const CSRF_EXEMPT_PREFIXES = new Set(["/auth", "/health"]);

const COOKIE_NAME = IS_PRODUCTION ? "__Host-planner_csrf" : "planner_csrf";

const TOKEN_BYTES = 32;

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

function signToken(token: string, sessionId: number | undefined): string {
  const data = sessionId !== undefined ? `${token}:${sessionId}` : token;
  return crypto.createHmac("sha256", CSRF_SECRET).update(data).digest("hex");
}

function verifyToken(token: string, hmac: string, sessionId: number | undefined): boolean {
  const expected = signToken(token, sessionId);
  if (expected.length !== hmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac));
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const basePath = req.path.split("/").slice(0, 2).join("/");
  if (CSRF_EXEMPT_PREFIXES.has(basePath) || CSRF_EXEMPT_PREFIXES.has(req.path)) {
    next();
    return;
  }

  if (SAFE_METHODS.has(req.method)) {
    const token = generateToken();
    const hmac = signToken(token, req.sessionId);
    res.cookie(COOKIE_NAME, `${token}:${hmac}`, {
      httpOnly: false,
      secure: IS_PRODUCTION,
      sameSite: "strict",
      path: "/",
    });
    next();
    return;
  }

  const headerToken = req.headers["x-xsrf-token"] as string | undefined;
  const cookie = req.cookies?.[COOKIE_NAME] as string | undefined;

  if (!headerToken || !cookie) {
    res.status(403).json({
      error: { code: "CSRF_INVALID", message: "Missing CSRF token" },
    });
    return;
  }

  const colonIndex = cookie.lastIndexOf(":");
  if (colonIndex === -1) {
    res.status(403).json({
      error: { code: "CSRF_INVALID", message: "Malformed CSRF cookie" },
    });
    return;
  }

  const cookieToken = cookie.substring(0, colonIndex);
  const cookieHmac = cookie.substring(colonIndex + 1);

  if (headerToken !== cookieToken) {
    res.status(403).json({
      error: { code: "CSRF_INVALID", message: "CSRF token mismatch" },
    });
    return;
  }

  if (!verifyToken(headerToken, cookieHmac, req.sessionId)) {
    res.status(403).json({
      error: { code: "CSRF_INVALID", message: "Invalid CSRF signature" },
    });
    return;
  }

  next();
}
