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

import {
  generateRawToken,
  hashToken,
  createSession,
  validateSession,
  touchSession,
  revokeSession,
  revokeAllUserSessions,
  deleteExpiredSessions,
  buildCookieName,
  buildCookieOptions,
  shouldTouch,
  resetTouchCounter,
} from "../sessionService.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetTouchCounter();
});

describe("generateRawToken", () => {
  it("generates a base64url string of 43 characters", () => {
    const token = generateRawToken();
    expect(token).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens", () => {
    const t1 = generateRawToken();
    const t2 = generateRawToken();
    expect(t1).not.toBe(t2);
  });
});

describe("hashToken", () => {
  it("returns a SHA-256 hex digest", () => {
    const token = "test-raw-token";
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it("returns deterministic results", () => {
    expect(hashToken("hello")).toBe(hashToken("hello"));
    expect(hashToken("hello")).not.toBe(hashToken("world"));
  });
});

describe("createSession", () => {
  it("inserts a session and returns the raw token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const rawToken = await createSession("user-1");

    expect(rawToken).toHaveLength(43);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const insertCall = mockQuery.mock.calls[0];
    expect(insertCall[0]).toContain("INSERT INTO sessions");
    expect(insertCall[1][0]).toBe("user-1");
    expect(insertCall[1][1]).toBe(hashToken(rawToken));
  });
});

describe("validateSession", () => {
  it("returns session context for a valid session", async () => {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: "user-1" }],
    });

    const ctx = await validateSession(rawToken);

    expect(ctx).toEqual({ userId: "user-1", sessionId: 1 });
    expect(mockQuery.mock.calls[0][1][0]).toBe(tokenHash);
  });

  it("returns null when session is revoked", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const ctx = await validateSession("invalid-token");
    expect(ctx).toBeNull();
  });
});

describe("touchSession", () => {
  it("updates last_seen_at and idle_expires_at", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await touchSession(1);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain("UPDATE sessions");
    expect(mockQuery.mock.calls[0][1][2]).toBe(1);
  });
});

describe("shouldTouch", () => {
  it("returns true every 10th call", () => {
    for (let i = 0; i < 9; i++) {
      expect(shouldTouch()).toBe(false);
    }
    expect(shouldTouch()).toBe(true);
    expect(shouldTouch()).toBe(false);
  });
});

describe("revokeSession", () => {
  it("marks the session as revoked", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await revokeSession(1);

    expect(mockQuery.mock.calls[0][0]).toContain("UPDATE sessions");
    expect(mockQuery.mock.calls[0][0]).toContain("revoked_at");
    expect(mockQuery.mock.calls[0][1][0]).toBe(1);
  });
});

describe("revokeAllUserSessions", () => {
  it("revokes all sessions for a user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await revokeAllUserSessions("user-1", "password-change");

    expect(mockQuery.mock.calls[0][1][0]).toBe("password-change");
    expect(mockQuery.mock.calls[0][1][1]).toBe("user-1");
  });
});

describe("deleteExpiredSessions", () => {
  it("deletes expired and revoked sessions", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 5 });

    const count = await deleteExpiredSessions();
    expect(count).toBe(5);
  });
});

describe("buildCookieName", () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("returns __Host- prefixed name in production", () => {
    process.env.NODE_ENV = "production";
    expect(buildCookieName()).toBe("__Host-planner_session");
  });

  it("returns unprefixed name in development", () => {
    process.env.NODE_ENV = "development";
    expect(buildCookieName()).toBe("planner_session");
  });
});

describe("buildCookieOptions", () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("returns secure cookie in production", () => {
    process.env.NODE_ENV = "production";
    const opts = buildCookieOptions();
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("strict");
  });

  it("returns non-secure cookie in development", () => {
    process.env.NODE_ENV = "development";
    const opts = buildCookieOptions();
    expect(opts.secure).toBe(false);
  });
});
