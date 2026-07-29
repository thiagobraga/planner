import type { Request, Response, NextFunction } from "express";
import {
  validateSession,
  buildCookieName,
  buildCookieOptions,
  needsTouch,
  touchSession,
} from "../services/sessionService.js";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieName = buildCookieName();
  const rawToken: string | undefined = req.cookies?.[cookieName];

  if (!rawToken) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid session" },
    });
    return;
  }

  const session = await validateSession(rawToken);

  if (!session) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Session expired or revoked" },
    });
    return;
  }

  req.userId = session.userId;
  req.sessionId = session.sessionId;

  if (needsTouch(session)) {
    touchSession(session.sessionId).catch(() => {});
    // Re-issue the cookie alongside the server-side slide. The cookie carries
    // its own fixed expiry, so without this it would eventually be dropped by
    // the browser while the session it points at was still perfectly valid.
    res.cookie(cookieName, rawToken, buildCookieOptions());
  }

  next();
}
