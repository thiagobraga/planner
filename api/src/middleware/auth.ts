import type { Request, Response, NextFunction } from "express";
import {
  validateSession,
  buildCookieName,
  buildCookieOptions,
  needsTouch,
  touchSession,
} from "../services/sessionService.js";
import { validateApiToken, tokenNeedsTouch, touchApiToken } from "../services/apiTokenService.js";
import {
  ACCESS_TOKEN_PREFIX,
  grantNeedsTouch,
  touchGrant,
  validateOAuthAccessToken,
} from "../services/oauthService.js";
import { PROTECTED_RESOURCE_METADATA_URL } from "../oauth/router.js";
import { setActor } from "./requestContext.js";

/** OAuth access tokens are minted for the MCP resource and are worthless anywhere else. */
const OAUTH_PATHS = new Set(["/mcp"]);

function parseBearer(req: Request): string | undefined {
  const header = req.headers?.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value.trim() : undefined;
}

function unauthorized(res: Response, message: string): void {
  // Tells non-browser clients (agents, MCP hosts) which scheme to retry with,
  // and OAuth-capable MCP clients where to start signing in (RFC 9728).
  res.setHeader("WWW-Authenticate", `Bearer realm="planner", resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}"`);
  res.status(401).json({ error: { code: "UNAUTHORIZED", message } });
}

async function acceptApiToken(
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
  setActor({ type: "token", credentialId: token.tokenId, label: token.name });

  if (tokenNeedsTouch(token)) {
    touchApiToken(token.tokenId).catch(() => {});
  }

  next();
}

async function acceptOAuthToken(
  rawToken: string,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!OAUTH_PATHS.has(req.path)) {
    res.status(403).json({
      error: { code: "TOKEN_NOT_ALLOWED", message: "OAuth access tokens are only valid for the MCP endpoint" },
    });
    return;
  }

  const grant = await validateOAuthAccessToken(rawToken);
  if (!grant) {
    unauthorized(res, "Access token invalid, expired or revoked");
    return;
  }

  req.userId = grant.userId;
  req.authMethod = "oauth";
  req.tokenScopes = grant.scopes;
  setActor({ type: "oauth", credentialId: grant.grantId, label: grant.clientName });

  if (grantNeedsTouch(grant)) {
    touchGrant(grant.grantId).catch(() => {});
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
    if (bearer?.startsWith(ACCESS_TOKEN_PREFIX)) {
      await acceptOAuthToken(bearer, req, res, next);
      return;
    }
    if (bearer) {
      await acceptApiToken(bearer, req, res, next);
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
