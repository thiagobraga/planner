import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPubClient: { publish: vi.fn().mockResolvedValue(1) },
  redisSubClient: {
    subscribe: vi.fn().mockImplementation((_channel: string, _callback: (msg: string) => void) =>
      Promise.resolve(undefined),
    ),
  },
}));

import {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  hashToken,
  generateRawToken,
} from "../sessionService.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("session lifecycle: create → validate → revoke", () => {
  it("full lifecycle: create, validate, revoke, then reject", async () => {
    const userId = "user-lifecycle-1";
    const tokenHash = hashToken("raw-token");

    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: userId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const rawToken = await createSession(userId);
    expect(rawToken).toHaveLength(43);

    const ctx1 = await validateSession(rawToken);
    expect(ctx1).toEqual({ userId, sessionId: 1 });

    await revokeSession(1);

    const ctx2 = await validateSession(rawToken);
    expect(ctx2).toBeNull();
  });

  it("rejects expired idle session", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await createSession("user-1");
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const ctx = await validateSession(generateRawToken());
    expect(ctx).toBeNull();
  });

  it("rejects expired absolute session", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await createSession("user-2");
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const ctx = await validateSession(generateRawToken());
    expect(ctx).toBeNull();
  });

  it("revokeAllUserSessions invalidates all sessions for that user", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 10, user_id: "user-revoke-all" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const t1 = await createSession("user-revoke-all");
    const t2 = await createSession("user-revoke-all");

    const ctx1 = await validateSession(t1);
    expect(ctx1).not.toBeNull();

    await revokeAllUserSessions("user-revoke-all", "password-change");

    const ctxAfter1 = await validateSession(t1);
    const ctxAfter2 = await validateSession(t2);
    expect(ctxAfter1).toBeNull();
    expect(ctxAfter2).toBeNull();
  });

  it("log out does not affect other users' sessions", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 20, user_id: "user-a" }] })
      .mockResolvedValueOnce({ rows: [{ id: 21, user_id: "user-b" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 21, user_id: "user-b" }] });

    const tA = await createSession("user-a");
    const tB = await createSession("user-b");

    const ctxA = await validateSession(tA);
    expect(ctxA?.userId).toBe("user-a");

    const ctxB = await validateSession(tB);
    expect(ctxB?.userId).toBe("user-b");

    await revokeSession(20);

    const ctxAfterA = await validateSession(tA);
    expect(ctxAfterA).toBeNull();

    const ctxAfterB = await validateSession(tB);
    expect(ctxAfterB).not.toBeNull();
    expect(ctxAfterB?.userId).toBe("user-b");
  });
});

describe("session token security", () => {
  it("database never receives raw token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const rawToken = await createSession("user-1");

    const insertCall = mockQuery.mock.calls[0];
    const storedHash = insertCall[1][1];

    expect(typeof storedHash).toBe("string");
    expect(storedHash).toHaveLength(64);
    expect(storedHash).not.toBe(rawToken);
    expect(storedHash).toBe(hashToken(rawToken));
  });

  it("validateSession hashes token before query", async () => {
    const rawToken = "some-raw-token-value";
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await validateSession(rawToken);

    const queryHash = mockQuery.mock.calls[0][1][0];
    expect(queryHash).toBe(hashToken(rawToken));
  });
});
