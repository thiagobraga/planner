import type { Request, Response, NextFunction } from "express";
import { validateSession, buildCookieName, shouldTouch, touchSession } from "../services/sessionService.js";

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

  if (shouldTouch()) {
    touchSession(session.sessionId).catch(() => {});
  }

  next();
}
