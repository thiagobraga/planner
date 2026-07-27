import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { securityLog } from "../utils/securityLogger.js";
import { revokeAllUserSessions } from "./sessionService.js";
import type { UserRole } from "./authService.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  disabledAt: string | null;
  lastSeenAt: string | null;
  activeSessions: number;
}

export interface ListUsersResult {
  users: AdminUser[];
  nextCursor: string | null;
}

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: Date;
  disabled_at: Date | null;
  last_seen_at: Date | null;
  active_sessions: string;
}

function mapUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    disabledAt: row.disabled_at ? row.disabled_at.toISOString() : null,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    activeSessions: Number(row.active_sessions),
  };
}

// Keyset pagination on (created_at, id): a page stays stable even while
// accounts are being created underneath it, which OFFSET does not.
function encodeCursor(user: AdminUser): string {
  return Buffer.from(`${user.createdAt}|${user.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf-8").split("|");
  if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
    throw new AppError({
      code: "INVALID_CURSOR",
      message: "Cursor is malformed",
      statusCode: 400,
    });
  }
  return { createdAt, id };
}

export async function listUsers(
  input: { search?: string; cursor?: string; limit?: number } = {},
): Promise<ListUsersResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const params: unknown[] = [];
  const conditions: string[] = [];

  const search = input.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`);
  }

  if (input.cursor) {
    const { createdAt, id } = decodeCursor(input.cursor);
    params.push(createdAt, id);
    conditions.push(`(u.created_at, u.id) < ($${params.length - 1}::timestamptz, $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit + 1);

  const result = await pool.query(
    `SELECT u.id,
            u.email,
            u.display_name,
            u.role,
            u.created_at,
            u.disabled_at,
            s.last_seen_at,
            COALESCE(s.active_sessions, 0) AS active_sessions
     FROM users u
     LEFT JOIN LATERAL (
       SELECT MAX(last_seen_at) AS last_seen_at, COUNT(*) AS active_sessions
       FROM sessions
       WHERE user_id = u.id
         AND revoked_at IS NULL
         AND (absolute_expires_at IS NULL OR absolute_expires_at > NOW())
         AND (idle_expires_at IS NULL OR idle_expires_at > NOW())
     ) s ON true
     ${where}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $${params.length}`,
    params,
  );

  const rows = result.rows as AdminUserRow[];
  const hasMore = rows.length > limit;
  const users = rows.slice(0, limit).map(mapUser);

  return {
    users,
    nextCursor: hasMore && users.length > 0 ? encodeCursor(users[users.length - 1]!) : null,
  };
}

async function getUser(userId: string): Promise<AdminUser> {
  const result = await pool.query(
    `SELECT u.id,
            u.email,
            u.display_name,
            u.role,
            u.created_at,
            u.disabled_at,
            s.last_seen_at,
            COALESCE(s.active_sessions, 0) AS active_sessions
     FROM users u
     LEFT JOIN LATERAL (
       SELECT MAX(last_seen_at) AS last_seen_at, COUNT(*) AS active_sessions
       FROM sessions
       WHERE user_id = u.id
         AND revoked_at IS NULL
         AND (absolute_expires_at IS NULL OR absolute_expires_at > NOW())
         AND (idle_expires_at IS NULL OR idle_expires_at > NOW())
     ) s ON true
     WHERE u.id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "User not found",
      statusCode: 404,
    });
  }

  return mapUser(result.rows[0] as AdminUserRow);
}

export async function disableUser(adminId: string, userId: string): Promise<AdminUser> {
  // An admin disabling themselves would revoke their own sessions and lock
  // them out of the only surface that can undo it.
  if (adminId === userId) {
    throw new AppError({
      code: "CANNOT_DISABLE_SELF",
      message: "You cannot disable your own account",
      statusCode: 400,
    });
  }

  const result = await pool.query(
    "UPDATE users SET disabled_at = NOW() WHERE id = $1 AND disabled_at IS NULL RETURNING id",
    [userId],
  );

  // No row updated means the user is already disabled, or does not exist -
  // getUser returns the former and 404s on the latter.
  if (result.rows.length === 0) {
    return getUser(userId);
  }

  await revokeAllUserSessions(userId, "admin-disable");
  securityLog.sessionRevoked(userId, "admin-disable", adminId);

  return getUser(userId);
}

export async function enableUser(adminId: string, userId: string): Promise<AdminUser> {
  const result = await pool.query(
    "UPDATE users SET disabled_at = NULL WHERE id = $1 RETURNING id",
    [userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "User not found",
      statusCode: 404,
    });
  }

  return getUser(userId);
}

export async function revokeSessions(adminId: string, userId: string): Promise<AdminUser> {
  const user = await getUser(userId);
  await revokeAllUserSessions(userId, "admin-revoke");
  securityLog.sessionRevoked(userId, "admin-revoke", adminId);
  return { ...user, activeSessions: 0 };
}
