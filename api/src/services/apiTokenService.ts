import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { validate, type ValidationError } from "../utils/validate.js";
import { securityLog } from "../utils/securityLogger.js";
import { generateRawToken, hashToken } from "./sessionService.js";
import { SESSION_TOUCH_INTERVAL_SECONDS } from "../config.js";
import {
  API_TOKEN_EXPIRY_DAYS,
  API_TOKEN_SCOPES,
  type ApiToken,
  type ApiTokenContext,
  type ApiTokenScope,
  type CreateApiTokenInput,
  type CreatedApiToken,
} from "../types/apiToken.js";

/** Recognizable prefix so secret scanners can flag leaked tokens. */
export const API_TOKEN_PREFIX = "plnr_";

const DISPLAY_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 8;
const MAX_ACTIVE_TOKENS = 20;
const MAX_NAME_LENGTH = 100;

interface ApiTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes: ApiTokenScope[];
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
}

function toApiToken(row: ApiTokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: row.scopes,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

function validateCreateInput(input: unknown): CreateApiTokenInput {
  const body = (input ?? {}) as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    errors.push({ field: "name", message: `Name must be 1-${MAX_NAME_LENGTH} characters` });
  }

  const scopes = body.scopes;
  const scopesValid =
    Array.isArray(scopes) &&
    scopes.length > 0 &&
    scopes.every((s) => API_TOKEN_SCOPES.includes(s as ApiTokenScope));
  if (!scopesValid) {
    errors.push({ field: "scopes", message: "Scopes must be a non-empty subset of read, write" });
  }

  const expires = body.expiresInDays;
  if (expires !== null && !API_TOKEN_EXPIRY_DAYS.includes(expires as (typeof API_TOKEN_EXPIRY_DAYS)[number])) {
    errors.push({ field: "expiresInDays", message: `Expiry must be one of ${API_TOKEN_EXPIRY_DAYS.join(", ")} or null` });
  }

  validate(errors);

  // A token that can write but not read is useless to an agent, which has to
  // look things up before changing them.
  const normalizedScopes: ApiTokenScope[] = (scopes as ApiTokenScope[]).includes("write")
    ? ["read", "write"]
    : ["read"];

  return {
    name,
    scopes: normalizedScopes,
    expiresInDays: expires as CreateApiTokenInput["expiresInDays"],
  };
}

export async function createApiToken(userId: string, input: unknown): Promise<CreatedApiToken> {
  const { name, scopes, expiresInDays } = validateCreateInput(input);

  const active = await pool.query(
    `SELECT COUNT(*)::int AS count FROM api_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId],
  );
  if ((active.rows[0] as { count: number }).count >= MAX_ACTIVE_TOKENS) {
    throw new AppError({
      code: "TOKEN_LIMIT_REACHED",
      message: `You can have at most ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.`,
      statusCode: 409,
    });
  }

  const rawToken = API_TOKEN_PREFIX + generateRawToken();
  const expiresAt = expiresInDays === null
    ? null
    : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO api_tokens (user_id, name, token_prefix, token_hash, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, token_prefix, scopes, created_at, last_used_at, expires_at`,
    [userId, name, rawToken.slice(0, DISPLAY_PREFIX_LENGTH), hashToken(rawToken), scopes, expiresAt],
  );

  const token = toApiToken(result.rows[0] as ApiTokenRow);
  securityLog.apiTokenCreated(userId, token.id, scopes);
  return { token, rawToken };
}

export async function listApiTokens(userId: string): Promise<ApiToken[]> {
  const result = await pool.query(
    `SELECT id, name, token_prefix, scopes, created_at, last_used_at, expires_at
     FROM api_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  return (result.rows as ApiTokenRow[]).map(toApiToken);
}

export async function validateApiToken(rawToken: string): Promise<ApiTokenContext | null> {
  if (!rawToken.startsWith(API_TOKEN_PREFIX)) return null;

  const result = await pool.query(
    `SELECT t.id, t.user_id, t.name, t.scopes, t.last_used_at
     FROM api_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1
       AND t.revoked_at IS NULL
       AND (t.expires_at IS NULL OR t.expires_at > NOW())
       AND u.disabled_at IS NULL`,
    [hashToken(rawToken)],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as {
    id: string;
    user_id: string;
    name: string;
    scopes: ApiTokenScope[];
    last_used_at: Date | null;
  };
  return {
    userId: row.user_id,
    tokenId: row.id,
    name: row.name,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
  };
}

/** Same bounded-write cadence as sessions, so a busy agent does not write on every call. */
export function tokenNeedsTouch(ctx: ApiTokenContext, now: Date = new Date()): boolean {
  if (!ctx.lastUsedAt) return true;
  return now.getTime() - ctx.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_SECONDS * 1000;
}

export async function touchApiToken(tokenId: string): Promise<void> {
  await pool.query("UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1", [tokenId]);
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE api_tokens SET revoked_at = NOW(), revoke_reason = 'user-revoke'
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [tokenId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Token not found", statusCode: 404 });
  }
  securityLog.apiTokenRevoked(userId, tokenId, "user-revoke");
}

export async function revokeAllUserTokens(userId: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE api_tokens SET revoked_at = NOW(), revoke_reason = $1
     WHERE user_id = $2 AND revoked_at IS NULL`,
    [reason, userId],
  );
}

/** Dead rows linger 30 days so the security log's token ids can still be traced. */
export async function deleteExpiredApiTokens(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM api_tokens
     WHERE (expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '30 days')
        OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')`,
  );
  return result.rowCount ?? 0;
}
