import crypto from "node:crypto";
import pool from "../db/pool.js";
import { securityLog } from "../utils/securityLogger.js";
import { SESSION_IDLE_TTL_MINUTES, SESSION_ABSOLUTE_TTL_HOURS } from "../config.js";

const RAW_TOKEN_BYTES = 32;
const TOUCH_EVERY_N_REQUESTS = 10;

export interface SessionContext {
  userId: string;
  sessionId: number;
}

interface SessionRow {
  id: number;
  user_id: string;
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

export function buildCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
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
    `SELECT id, user_id
     FROM sessions
     WHERE token_hash_sha256 = $1
       AND (revoked_at IS NULL)
       AND (absolute_expires_at IS NULL OR absolute_expires_at > NOW())
       AND (idle_expires_at IS NULL OR idle_expires_at > NOW())`,
    [tokenHash],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as SessionRow;
  return { userId: row.user_id, sessionId: row.id };
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

let touchCounter = 0;

export function shouldTouch(): boolean {
  touchCounter = (touchCounter + 1) % TOUCH_EVERY_N_REQUESTS;
  return touchCounter === 0;
}

export function resetTouchCounter(): void {
  touchCounter = 0;
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
