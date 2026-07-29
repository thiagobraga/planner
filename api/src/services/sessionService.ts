import crypto from "node:crypto";
import pool from "../db/pool.js";
import { securityLog } from "../utils/securityLogger.js";
import {
  SESSION_IDLE_TTL_MINUTES,
  SESSION_ABSOLUTE_TTL_HOURS,
  SESSION_TOUCH_INTERVAL_SECONDS,
} from "../config.js";

const RAW_TOKEN_BYTES = 32;

export interface SessionContext {
  userId: string;
  sessionId: number;
  /** Null only on rows written before migration 027 added the column. */
  lastSeenAt: Date | null;
}

interface SessionRow {
  id: number;
  user_id: string;
  last_seen_at: Date | null;
}

export function generateRawToken(): string {
  return crypto.randomBytes(RAW_TOKEN_BYTES).toString("base64url");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function buildCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-planner_session"
    : "planner_session";
}

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

export function buildCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax`, not `strict`. A strict cookie is withheld on top-level navigation
    // that originates anywhere else - a link in a mail client, a chat message,
    // a search result - so the first page load renders logged-out even though
    // the session is alive and the next in-app request would have worked.
    // Cross-site writes are already blocked by originCheck plus the signed
    // double-submit token in csrf.ts; neither leans on SameSite.
    sameSite: "lax" as const,
    path: "/",
    // Without an explicit lifetime this is a browser-session cookie: it dies
    // when the browser closes no matter how long the server-side session is
    // good for. Match the idle window, and re-issue it on every touch (see
    // authMiddleware) so it slides forward with the session rather than
    // expiring at the fixed date it was minted with.
    maxAge: SESSION_IDLE_TTL_MINUTES * 60 * 1000,
  };
}

/**
 * `res.clearCookie` only removes a cookie when the attributes it sends match
 * the ones the cookie was set with, and the `__Host-` prefix additionally
 * requires Secure - so a mismatched clear is rejected outright by the browser
 * and the dead cookie survives logout.
 */
export function buildClearCookieOptions(): Omit<SessionCookieOptions, "maxAge"> {
  const options: Omit<SessionCookieOptions, "maxAge"> & { maxAge?: number } =
    buildCookieOptions();
  // express writes its own past expiry when clearing; carrying a positive
  // Max-Age alongside it is contradictory.
  delete options.maxAge;
  return options;
}

export async function createSession(userId: string): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const idleExpiresAt = new Date(
    now.getTime() + SESSION_IDLE_TTL_MINUTES * 60 * 1000,
  );
  const absoluteExpiresAt = new Date(
    now.getTime() + SESSION_ABSOLUTE_TTL_HOURS * 60 * 60 * 1000,
  );

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash_sha256, last_seen_at, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, now, idleExpiresAt, absoluteExpiresAt],
  );

  return rawToken;
}

export async function validateSession(
  rawToken: string,
): Promise<SessionContext | null> {
  const tokenHash = hashToken(rawToken);

  const result = await pool.query(
    `SELECT id, user_id, last_seen_at
     FROM sessions
     WHERE token_hash_sha256 = $1
       AND (revoked_at IS NULL)
       AND (absolute_expires_at IS NULL OR absolute_expires_at > NOW())
       AND (idle_expires_at IS NULL OR idle_expires_at > NOW())`,
    [tokenHash],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as SessionRow;
  return {
    userId: row.user_id,
    sessionId: row.id,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
  };
}

export async function touchSession(sessionId: number): Promise<void> {
  const now = new Date();
  const newIdleExpiry = new Date(
    now.getTime() + SESSION_IDLE_TTL_MINUTES * 60 * 1000,
  );

  await pool.query(
    `UPDATE sessions
     SET last_seen_at = $1, idle_expires_at = $2
     WHERE id = $3`,
    [now, newIdleExpiry, sessionId],
  );
}

/**
 * Whether this session's idle window is stale enough to be worth a write.
 *
 * This replaced a module-level "every Nth request" counter. That counter was
 * shared by every session on the process and reset on restart, so whether a
 * given session got its idle window slid depended on how many requests other
 * sessions happened to make - a user could browse for an hour without a single
 * touch landing on their row and be logged out mid-use. Comparing against the
 * `last_seen_at` the validate query already returned is per-session, needs no
 * extra query, and still bounds writes to one per interval.
 */
export function needsTouch(
  session: SessionContext,
  now: Date = new Date(),
): boolean {
  if (!session.lastSeenAt) return true;
  return (
    now.getTime() - session.lastSeenAt.getTime() >=
    SESSION_TOUCH_INTERVAL_SECONDS * 1000
  );
}

export async function revokeSession(sessionId: number): Promise<void> {
  const result = await pool.query(
    `UPDATE sessions
     SET revoked_at = NOW(), revoke_reason = 'manual-revoke'
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING user_id`,
    [sessionId],
  );
  if (result.rows.length > 0) {
    securityLog.sessionRevoked(result.rows[0].user_id, "manual-revoke");
  }
}

export async function revokeAllUserSessions(
  userId: string,
  reason = "password-change",
): Promise<void> {
  await pool.query(
    `UPDATE sessions
     SET revoked_at = NOW(), revoke_reason = $1
     WHERE user_id = $2 AND revoked_at IS NULL`,
    [reason, userId],
  );
}

export async function deleteExpiredSessions(): Promise<number> {
  const deleted = await pool.query(
    `DELETE FROM sessions
     WHERE (absolute_expires_at IS NOT NULL AND absolute_expires_at < NOW())
        OR (idle_expires_at IS NOT NULL AND idle_expires_at < NOW())
        OR revoked_at IS NOT NULL`,
  );
  return deleted.rowCount ?? 0;
}

export async function findValidSessionByUserId(
  userId: string,
): Promise<number | null> {
  const result = await pool.query(
    `SELECT id FROM sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND (absolute_expires_at IS NULL OR absolute_expires_at > NOW())
       AND (idle_expires_at IS NULL OR idle_expires_at > NOW())
     ORDER BY last_seen_at DESC
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) return null;
  return (result.rows[0] as { id: number }).id;
}
