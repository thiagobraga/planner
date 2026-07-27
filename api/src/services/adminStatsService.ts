import pool from "../db/pool.js";
import { redisClient } from "../db/redis.js";

const REDIS_PING_TIMEOUT_MS = 1000;
const RATE_LIMIT_SCAN_COUNT = 500;

export interface AdminCounts {
  users: number;
  activeUsers: number;
  disabledUsers: number;
  admins: number;
  tasks: number;
  completedTasks: number;
  collections: number;
  habits: number;
}

export interface AdminHealth {
  database: {
    status: "up" | "down";
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
  };
  redis: { status: "up" | "down" };
  process: {
    uptimeSeconds: number;
    memoryRssBytes: number;
    nodeVersion: string;
  };
}

export interface AdminAuthStats {
  activeSessions: number;
  sessionsLastDay: number;
  usersOnlineLastHour: number;
  throttledAccounts: number;
  throttledIps: number;
  failedLoginAttempts: number;
}

export async function getCounts(): Promise<AdminCounts> {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE disabled_at IS NULL) AS active_users,
       (SELECT COUNT(*) FROM users WHERE disabled_at IS NOT NULL) AS disabled_users,
       (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
       (SELECT COUNT(*) FROM tasks) AS tasks,
       (SELECT COUNT(*) FROM tasks WHERE is_completed) AS completed_tasks,
       (SELECT COUNT(*) FROM collections) AS collections,
       (SELECT COUNT(*) FROM habits) AS habits`,
  );

  const row = result.rows[0];

  return {
    users: Number(row.users),
    activeUsers: Number(row.active_users),
    disabledUsers: Number(row.disabled_users),
    admins: Number(row.admins),
    tasks: Number(row.tasks),
    completedTasks: Number(row.completed_tasks),
    collections: Number(row.collections),
    habits: Number(row.habits),
  };
}

async function pingRedis(): Promise<"up" | "down"> {
  if (!redisClient.isReady) return "down";

  // A hung Redis must not hang the dashboard request behind it.
  const timeout = new Promise<"down">((resolve) =>
    setTimeout(() => resolve("down"), REDIS_PING_TIMEOUT_MS).unref(),
  );

  return Promise.race([
    redisClient.ping().then((): "up" | "down" => "up").catch((): "up" | "down" => "down"),
    timeout,
  ]);
}

export async function getSystemHealth(): Promise<AdminHealth> {
  let databaseStatus: "up" | "down" = "up";
  try {
    await pool.query("SELECT 1");
  } catch {
    databaseStatus = "down";
  }

  return {
    database: {
      status: databaseStatus,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount,
    },
    redis: { status: await pingRedis() },
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssBytes: process.memoryUsage().rss,
      nodeVersion: process.version,
    },
  };
}

/**
 * Failed-login signal comes from the keys rateLimitService already maintains
 * (`rl:acct:<sha256(email)>`, `rl:login:ip:<ip>`) rather than a parallel
 * counter. It is therefore a live window, not an all-time total: keys expire
 * after the 15-minute rate-limit window and are deleted on a successful login.
 */
async function readRateLimitKeys(): Promise<{
  throttledAccounts: number;
  throttledIps: number;
  failedLoginAttempts: number;
}> {
  const empty = { throttledAccounts: 0, throttledIps: 0, failedLoginAttempts: 0 };
  if (!redisClient.isReady) return empty;

  try {
    let throttledAccounts = 0;
    let throttledIps = 0;
    let failedLoginAttempts = 0;

    for (const pattern of ["rl:acct:*", "rl:login:ip:*"]) {
      const keys: string[] = [];
      for await (const key of redisClient.scanIterator({
        MATCH: pattern,
        COUNT: RATE_LIMIT_SCAN_COUNT,
      })) {
        keys.push(...(Array.isArray(key) ? key : [key]));
      }

      if (keys.length === 0) continue;

      const values = await redisClient.mGet(keys);
      const attempts = values.reduce<number>(
        (sum, value) => sum + (value ? parseInt(value, 10) || 0 : 0),
        0,
      );

      failedLoginAttempts += attempts;
      if (pattern === "rl:acct:*") {
        throttledAccounts = keys.length;
      } else {
        throttledIps = keys.length;
      }
    }

    return { throttledAccounts, throttledIps, failedLoginAttempts };
  } catch {
    return empty;
  }
}

export async function getAuthStats(): Promise<AdminAuthStats> {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE revoked_at IS NULL
           AND (absolute_expires_at IS NULL OR absolute_expires_at > NOW())
           AND (idle_expires_at IS NULL OR idle_expires_at > NOW())
       ) AS active_sessions,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS sessions_last_day,
       COUNT(DISTINCT user_id) FILTER (WHERE last_seen_at > NOW() - INTERVAL '1 hour') AS users_online_last_hour
     FROM sessions`,
  );

  const row = result.rows[0];
  const rateLimits = await readRateLimitKeys();

  return {
    activeSessions: Number(row.active_sessions),
    sessionsLastDay: Number(row.sessions_last_day),
    usersOnlineLastHour: Number(row.users_online_last_hour),
    ...rateLimits,
  };
}
