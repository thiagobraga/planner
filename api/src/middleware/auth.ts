import type { Request, Response, NextFunction } from "express";
import {
  validateSession,
  buildCookieName,
  buildCookieOptions,
  needsTouch,
  touchSession,
} from "../services/sessionService.js";
import { validateApiToken, tokenNeedsTouch, touchApiToken } from "../services/apiTokenService.js";

function parseBearer(req: Request): string | undefined {
  const header = req.headers?.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value.trim() : undefined;
}

function unauthorized(res: Response, message: string): void {
  // Tells non-browser clients (agents, MCP hosts) which scheme to retry with.
  res.setHeader("WWW-Authenticate", 'Bearer realm="planner"');
  res.status(401).json({ error: { code: "UNAUTHORIZED", message } });
}

async function authenticateToken(
  rawToken: string,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = await validateApiToken(rawToken);
  if (!token) {
    unauthorized(res, "API token invalid, expired or revoked");
    return;
  }

  req.userId = token.userId;
  req.authMethod = "token";
  req.tokenId = token.tokenId;
  req.tokenScopes = token.scopes;

  if (tokenNeedsTouch(token)) {
    touchApiToken(token.tokenId).catch(() => {});
  }

  next();
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieName = buildCookieName();
  const rawToken: string | undefined = req.cookies?.[cookieName];

  // A browser session always wins: the web app never sends a bearer header,
  // so a request carrying both is a browser and should be judged as one.
  if (!rawToken) {
    const bearer = parseBearer(req);
    if (bearer) {
      await authenticateToken(bearer, req, res, next);
      return;
    }
    unauthorized(res, "Missing or invalid session");
    return;
  }

  const session = await validateSession(rawToken);

  if (!session) {
    unauthorized(res, "Session expired or revoked");
    return;
  }

  req.userId = session.userId;
  req.sessionId = session.sessionId;
  req.authMethod = "session";

  if (needsTouch(session)) {
    touchSession(session.sessionId).catch(() => {});
    // Re-issue the cookie alongside the server-side slide. The cookie carries
    // its own fixed expiry, so without this it would eventually be dropped by
    // the browser while the session it points at was still perfectly valid.
    res.cookie(cookieName, rawToken, buildCookieOptions());
  }

  next();
}
