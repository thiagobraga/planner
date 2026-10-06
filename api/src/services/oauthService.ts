import crypto from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidScopeError, InvalidTargetError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { securityLog } from "../utils/securityLogger.js";
import { hashToken } from "./sessionService.js";
import { SESSION_TOUCH_INTERVAL_SECONDS } from "../config.js";
import type { ApiTokenScope } from "../types/apiToken.js";
import type {
  AuthorizationRequestParams,
  ConnectedApp,
  ConsentDecision,
  IssuedTokens,
  OAuthAccessContext,
  PendingAuthorization,
} from "../types/oauth.js";

export const ACCESS_TOKEN_PREFIX = "plnr_oat_";
const REFRESH_TOKEN_PREFIX = "plnr_ort_";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;
const CODE_TTL_SECONDS = 60;
const REQUEST_TTL_MINUTES = 10;

function randomSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Clients ---------------------------------------------------------------

export async function saveClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
  await pool.query(
    "INSERT INTO oauth_clients (client_id, client_name, metadata) VALUES ($1, $2, $3)",
    [client.client_id, client.client_name ?? "Unnamed app", JSON.stringify(client)],
  );
  return client;
}

export async function findClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
  const result = await pool.query("SELECT metadata FROM oauth_clients WHERE client_id = $1", [clientId]);
  return (result.rows[0] as { metadata: OAuthClientInformationFull } | undefined)?.metadata;
}

// Authorization requests --------------------------------------------------

export async function createAuthorizationRequest(params: AuthorizationRequestParams): Promise<string> {
  const result = await pool.query(
    `INSERT INTO oauth_authorization_requests (client_id, redirect_uri, code_challenge, scopes, state, resource, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(mins => $7))
     RETURNING id`,
    [params.clientId, params.redirectUri, params.codeChallenge, params.scopes, params.state ?? null, params.resource, REQUEST_TTL_MINUTES],
  );
  return (result.rows[0] as { id: string }).id;
}

const requestGone = () =>
  new AppError({ code: "NOT_FOUND", message: "This sign-in request has expired. Start again from the app.", statusCode: 404 });

export async function getAuthorizationRequest(id: string): Promise<PendingAuthorization> {
  const result = await pool.query(
    `SELECT r.id, r.redirect_uri, r.scopes, c.client_name, c.metadata->>'client_uri' AS client_uri
     FROM oauth_authorization_requests r JOIN oauth_clients c ON c.client_id = r.client_id
     WHERE r.id = $1 AND r.expires_at > NOW()`,
    [id],
  );
  const row = result.rows[0] as
    | { id: string; redirect_uri: string; scopes: ApiTokenScope[]; client_name: string; client_uri: string | null }
    | undefined;
  if (!row) throw requestGone();
  return {
    id: row.id,
    clientName: row.client_name,
    clientUri: row.client_uri,
    redirectHost: new URL(row.redirect_uri).host,
    scopes: row.scopes,
  };
}

/** Settle a consent request; returns where to send the browser next. */
export async function decideAuthorizationRequest(
  userId: string,
  requestId: string,
  decision: ConsentDecision,
): Promise<{ redirectUrl: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Deleting first makes the request single-use even under a double submit.
    const deleted = await client.query(
      `DELETE FROM oauth_authorization_requests WHERE id = $1 AND expires_at > NOW()
       RETURNING client_id, redirect_uri, code_challenge, scopes, state, resource`,
      [requestId],
    );
    const request = deleted.rows[0] as
      | { client_id: string; redirect_uri: string; code_challenge: string; scopes: ApiTokenScope[]; state: string | null; resource: string }
      | undefined;
    if (!request) throw requestGone();

    const redirect = new URL(request.redirect_uri);
    if (request.state !== null) redirect.searchParams.set("state", request.state);

    if (decision === "deny") {
      redirect.searchParams.set("error", "access_denied");
      await client.query("COMMIT");
      return { redirectUrl: redirect.href };
    }

    const scopes: ApiTokenScope[] =
      decision === "write" && request.scopes.includes("write") ? ["read", "write"] : ["read"];

    // One live grant per user and app: re-connecting replaces the old one.
    await client.query(
      `UPDATE oauth_grants SET revoked_at = NOW(), revoke_reason = 'reauthorized'
       WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL`,
      [userId, request.client_id],
    );
    const grant = await client.query(
      "INSERT INTO oauth_grants (user_id, client_id, scopes, resource) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, request.client_id, scopes, request.resource],
    );
    const code = randomSecret();
    await client.query(
      `INSERT INTO oauth_codes (code_hash, grant_id, redirect_uri, code_challenge, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + make_interval(secs => $5))`,
      [hashToken(code), (grant.rows[0] as { id: string }).id, request.redirect_uri, request.code_challenge, CODE_TTL_SECONDS],
    );
    await client.query("COMMIT");

    redirect.searchParams.set("code", code);
    return { redirectUrl: redirect.href };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Codes and tokens --------------------------------------------------------

const badGrant = () => new InvalidGrantError("Invalid, expired or already used grant");

async function revokeGrant(grantId: string, reason: string): Promise<void> {
  await pool.query(
    "UPDATE oauth_grants SET revoked_at = NOW(), revoke_reason = $2 WHERE id = $1 AND revoked_at IS NULL",
    [grantId, reason],
  );
}

export async function challengeForCode(clientId: string, code: string): Promise<string> {
  const result = await pool.query(
    `SELECT c.code_challenge FROM oauth_codes c JOIN oauth_grants g ON g.id = c.grant_id
     WHERE c.code_hash = $1 AND g.client_id = $2`,
    [hashToken(code), clientId],
  );
  const row = result.rows[0] as { code_challenge: string } | undefined;
  if (!row) throw badGrant();
  return row.code_challenge;
}

async function issueTokens(grantId: string, scopes: ApiTokenScope[]): Promise<IssuedTokens> {
  const access = ACCESS_TOKEN_PREFIX + randomSecret();
  const refresh = REFRESH_TOKEN_PREFIX + randomSecret();
  await pool.query(
    `INSERT INTO oauth_tokens (token_hash, grant_id, kind, expires_at) VALUES
       ($1, $3, 'access', NOW() + make_interval(secs => $4)),
       ($2, $3, 'refresh', NOW() + make_interval(days => $5))`,
    [hashToken(access), hashToken(refresh), grantId, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS],
  );
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refresh,
    scope: scopes.join(" "),
  };
}

export async function exchangeCode(
  clientId: string,
  code: string,
  redirectUri: string | undefined,
  resource: string | undefined,
): Promise<IssuedTokens> {
  const codeHash = hashToken(code);
  const used = await pool.query(
    `UPDATE oauth_codes c SET used_at = NOW()
     FROM oauth_grants g
     WHERE c.code_hash = $1 AND c.grant_id = g.id AND g.client_id = $2
       AND c.used_at IS NULL AND c.expires_at > NOW() AND g.revoked_at IS NULL
     RETURNING c.grant_id, c.redirect_uri, g.scopes, g.resource`,
    [codeHash, clientId],
  );
  const row = used.rows[0] as
    | { grant_id: string; redirect_uri: string; scopes: ApiTokenScope[]; resource: string }
    | undefined;

  if (!row) {
    // A code presented twice was intercepted somewhere; kill what it unlocked.
    const replay = await pool.query("SELECT grant_id FROM oauth_codes WHERE code_hash = $1 AND used_at IS NOT NULL", [codeHash]);
    if (replay.rows[0]) await revokeGrant((replay.rows[0] as { grant_id: string }).grant_id, "code-reuse");
    throw badGrant();
  }
  if (redirectUri !== undefined && redirectUri !== row.redirect_uri) throw badGrant();
  if (resource !== undefined && resource !== row.resource) throw new InvalidTargetError("Unknown resource");

  return issueTokens(row.grant_id, row.scopes);
}

export async function exchangeRefresh(
  clientId: string,
  refreshToken: string,
  requestedScopes: string[] | undefined,
  resource: string | undefined,
): Promise<IssuedTokens> {
  const result = await pool.query(
    `SELECT t.used_at, t.expires_at > NOW() AS live, g.id AS grant_id, g.client_id, g.scopes, g.resource,
            g.revoked_at IS NULL AS grant_live, u.disabled_at IS NULL AS user_live
     FROM oauth_tokens t
     JOIN oauth_grants g ON g.id = t.grant_id
     JOIN users u ON u.id = g.user_id
     WHERE t.token_hash = $1 AND t.kind = 'refresh'`,
    [hashToken(refreshToken)],
  );
  const row = result.rows[0] as
    | { used_at: Date | null; live: boolean; grant_id: string; client_id: string; scopes: ApiTokenScope[]; resource: string; grant_live: boolean; user_live: boolean }
    | undefined;
  if (!row || row.client_id !== clientId) throw badGrant();

  if (row.used_at) {
    // Rotated refresh tokens are single-use; a second use means a copy leaked.
    await revokeGrant(row.grant_id, "refresh-reuse");
    throw badGrant();
  }
  if (!row.live || !row.grant_live || !row.user_live) throw badGrant();
  if (requestedScopes?.some((scope) => !row.scopes.includes(scope as ApiTokenScope))) {
    throw new InvalidScopeError("Requested scope exceeds what was granted");
  }
  if (resource !== undefined && resource !== row.resource) throw new InvalidTargetError("Unknown resource");

  const marked = await pool.query(
    "UPDATE oauth_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL RETURNING token_hash",
    [hashToken(refreshToken)],
  );
  if (marked.rows.length === 0) {
    await revokeGrant(row.grant_id, "refresh-reuse");
    throw badGrant();
  }
  return issueTokens(row.grant_id, row.scopes);
}

/** RFC 7009: revoking any token of a grant ends the whole connection. Unknown tokens are ignored. */
export async function revokeByToken(clientId: string, token: string): Promise<void> {
  const result = await pool.query(
    `SELECT g.id FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
     WHERE t.token_hash = $1 AND g.client_id = $2`,
    [hashToken(token), clientId],
  );
  const row = result.rows[0] as { id: string } | undefined;
  if (row) await revokeGrant(row.id, "client-revoke");
}

export async function validateOAuthAccessToken(raw: string): Promise<OAuthAccessContext | null> {
  if (!raw.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const result = await pool.query(
    `SELECT g.user_id, g.id AS grant_id, g.client_id, c.client_name, g.scopes, g.last_used_at, t.expires_at
     FROM oauth_tokens t
     JOIN oauth_grants g ON g.id = t.grant_id
     JOIN oauth_clients c ON c.client_id = g.client_id
     JOIN users u ON u.id = g.user_id
     WHERE t.token_hash = $1 AND t.kind = 'access' AND t.expires_at > NOW()
       AND g.revoked_at IS NULL AND u.disabled_at IS NULL`,
    [hashToken(raw)],
  );
  const row = result.rows[0] as
    | { user_id: string; grant_id: string; client_id: string; client_name: string; scopes: ApiTokenScope[]; last_used_at: Date | null; expires_at: Date }
    | undefined;
  if (!row) return null;
  return {
    userId: row.user_id,
    grantId: row.grant_id,
    clientId: row.client_id,
    clientName: row.client_name,
    scopes: row.scopes,
    expiresAt: new Date(row.expires_at),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
  };
}

export function grantNeedsTouch(ctx: OAuthAccessContext, now: Date = new Date()): boolean {
  return !ctx.lastUsedAt || now.getTime() - ctx.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_SECONDS * 1000;
}

export async function touchGrant(grantId: string): Promise<void> {
  await pool.query("UPDATE oauth_grants SET last_used_at = NOW() WHERE id = $1", [grantId]);
}

// Connected apps ----------------------------------------------------------

export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const result = await pool.query(
    `SELECT g.id, c.client_name, c.metadata->>'client_uri' AS client_uri, g.scopes, g.created_at, g.last_used_at
     FROM oauth_grants g JOIN oauth_clients c ON c.client_id = g.client_id
     WHERE g.user_id = $1 AND g.revoked_at IS NULL
     ORDER BY g.created_at DESC`,
    [userId],
  );
  return (result.rows as Array<{
    id: string; client_name: string; client_uri: string | null; scopes: ApiTokenScope[]; created_at: Date; last_used_at: Date | null;
  }>).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    clientUri: row.client_uri,
    scopes: row.scopes,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  }));
}

export async function disconnectApp(userId: string, grantId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE oauth_grants SET revoked_at = NOW(), revoke_reason = 'user-disconnect'
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
    [grantId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Connected app not found", statusCode: 404 });
  }
  securityLog.sessionRevoked(userId, "oauth-disconnect");
}

export async function revokeAllUserGrants(userId: string, reason: string): Promise<void> {
  await pool.query(
    "UPDATE oauth_grants SET revoked_at = NOW(), revoke_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL",
    [userId, reason],
  );
}

/** Spent codes, stale requests and dead tokens have no further use. */
export async function deleteExpiredOAuthRows(): Promise<void> {
  await pool.query("DELETE FROM oauth_authorization_requests WHERE expires_at < NOW()");
  await pool.query("DELETE FROM oauth_codes WHERE expires_at < NOW() - INTERVAL '1 day'");
  await pool.query("DELETE FROM oauth_tokens WHERE expires_at < NOW() - INTERVAL '1 day'");
}
