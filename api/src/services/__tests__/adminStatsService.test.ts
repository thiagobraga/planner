import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above these declarations, so the stubs it closes over
// have to be hoisted with it.
const {
  mockQuery,
  mockPing,
  mockMGet,
  mockScanIterator,
  poolStub,
  redisStub,
} = vi.hoisted(() => {
  const query = vi.fn();
  const ping = vi.fn();
  const mGet = vi.fn();
  const scanIterator = vi.fn();

  return {
    mockQuery: query,
    mockPing: ping,
    mockMGet: mGet,
    mockScanIterator: scanIterator,
    poolStub: {
      query: (...args: unknown[]) => query(...args),
      totalCount: 7,
      idleCount: 5,
      waitingCount: 2,
    },
    redisStub: {
      isReady: true,
      ping: (...args: unknown[]) => ping(...args),
      mGet: (...args: unknown[]) => mGet(...args),
      scanIterator: (...args: unknown[]) => scanIterator(...args),
    },
  };
});

vi.mock("../../db/pool.js", () => ({ default: poolStub }));
vi.mock("../../db/redis.js", () => ({ redisClient: redisStub }));

import { getCounts, getSystemHealth, getAuthStats } from "../adminStatsService.js";

/** Turns a fixed key list into the async iterator scanIterator returns. */
function scanReturning(keysByPattern: Record<string, string[]>) {
  return (options: { MATCH: string }) => {
    const keys = keysByPattern[options.MATCH] ?? [];
    return (async function* () {
      for (const key of keys) yield key;
    })();
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockPing.mockReset();
  mockMGet.mockReset();
  mockScanIterator.mockReset();
  redisStub.isReady = true;
  mockPing.mockResolvedValue("PONG");
  mockScanIterator.mockImplementation(scanReturning({}));
  mockMGet.mockResolvedValue([]);
});

describe("getCounts", () => {
  it("returns every count as a number", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          users: "10",
          active_users: "8",
          disabled_users: "2",
          admins: "1",
          tasks: "120",
          completed_tasks: "45",
          collections: "9",
          habits: "4",
        },
      ],
    });

    const counts = await getCounts();

    expect(counts).toEqual({
      users: 10,
      activeUsers: 8,
      disabledUsers: 2,
      admins: 1,
      tasks: 120,
      completedTasks: 45,
      collections: 9,
      habits: 4,
    });
  });
});

describe("getSystemHealth", () => {
  it("reports pool figures, a Redis ping and process vitals", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    const health = await getSystemHealth();

    expect(health.database).toEqual({
      status: "up",
      totalConnections: 7,
      idleConnections: 5,
      waitingRequests: 2,
    });
    expect(health.redis.status).toBe("up");
    expect(health.process.nodeVersion).toBe(process.version);
    expect(health.process.memoryRssBytes).toBeGreaterThan(0);
  });

  it("reports the database down instead of throwing", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));

    const health = await getSystemHealth();

    expect(health.database.status).toBe("down");
  });

  it("reports Redis down when the client is not ready", async () => {
    redisStub.isReady = false;
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const health = await getSystemHealth();

    expect(health.redis.status).toBe("down");
    expect(mockPing).not.toHaveBeenCalled();
  });

  it("reports Redis down when the ping rejects", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockPing.mockRejectedValueOnce(new Error("no connection"));

    const health = await getSystemHealth();

    expect(health.redis.status).toBe("down");
  });
});

describe("getAuthStats", () => {
  function sessionCounts() {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          active_sessions: "12",
          sessions_last_day: "5",
          users_online_last_hour: "3",
        },
      ],
    });
  }

  it("reads session figures from the sessions table", async () => {
    sessionCounts();

    const stats = await getAuthStats();

    expect(stats.activeSessions).toBe(12);
    expect(stats.sessionsLastDay).toBe(5);
    expect(stats.usersOnlineLastHour).toBe(3);
  });

  it("derives failed logins from the rate limiter's own Redis keys", async () => {
    sessionCounts();
    mockScanIterator.mockImplementation(
      scanReturning({
        "rl:acct:*": ["rl:acct:aaa", "rl:acct:bbb"],
        "rl:login:ip:*": ["rl:login:ip:10.0.0.1"],
      }),
    );
    mockMGet.mockResolvedValueOnce(["4", "2"]).mockResolvedValueOnce(["6"]);

    const stats = await getAuthStats();

    expect(stats.throttledAccounts).toBe(2);
    expect(stats.throttledIps).toBe(1);
    expect(stats.failedLoginAttempts).toBe(12);
  });

  it("reports zeroed rate-limit figures when Redis is unavailable", async () => {
    sessionCounts();
    redisStub.isReady = false;

    const stats = await getAuthStats();

    expect(stats.throttledAccounts).toBe(0);
    expect(stats.throttledIps).toBe(0);
    expect(stats.failedLoginAttempts).toBe(0);
    expect(stats.activeSessions).toBe(12);
  });

  it("swallows a Redis scan failure rather than failing the whole request", async () => {
    sessionCounts();
    mockScanIterator.mockImplementation(() => {
      throw new Error("scan blew up");
    });

    const stats = await getAuthStats();

    expect(stats.failedLoginAttempts).toBe(0);
    expect(stats.activeSessions).toBe(12);
  });
});
