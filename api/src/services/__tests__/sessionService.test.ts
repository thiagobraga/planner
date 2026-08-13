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
  buildClearCookieOptions,
  needsTouch,
} from "../sessionService.js";

beforeEach(() => {
  vi.clearAllMocks();
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
    const lastSeen = new Date("2026-01-01T00:00:00.000Z");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: "user-1", last_seen_at: lastSeen }],
    });

    const ctx = await validateSession(rawToken);

    expect(ctx).toEqual({ userId: "user-1", sessionId: 1, lastSeenAt: lastSeen });
    expect(mockQuery.mock.calls[0][1][0]).toBe(tokenHash);
  });

  it("selects last_seen_at so callers can decide about touching without a second query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await validateSession("any-token");
    expect(mockQuery.mock.calls[0][0]).toContain("last_seen_at");
  });

  it("returns a null lastSeenAt for pre-027 rows that never had one", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: "user-1", last_seen_at: null }],
    });

    const ctx = await validateSession("any-token");
    expect(ctx?.lastSeenAt).toBeNull();
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

describe("needsTouch", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const session = (lastSeenAt: Date | null) => ({
    userId: "user-1",
    sessionId: 1,
    lastSeenAt,
  });

  it("touches a session that has never been seen", () => {
    expect(needsTouch(session(null), now)).toBe(true);
  });

  it("skips a session seen within the touch interval", () => {
    const seenOneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    expect(needsTouch(session(seenOneMinuteAgo), now)).toBe(false);
  });

  it("touches a session seen longer ago than the touch interval", () => {
    const seenTenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(needsTouch(session(seenTenMinutesAgo), now)).toBe(true);
  });

  // The counter this replaced was shared by every session on the process, so
  // one session's traffic decided whether another's idle window got slid.
  it("decides per session rather than from shared request counts", () => {
    const stale = session(new Date(now.getTime() - 10 * 60 * 1000));
    const fresh = { ...session(new Date(now.getTime() - 1000)), sessionId: 2 };

    for (let i = 0; i < 25; i++) {
      expect(needsTouch(fresh, now)).toBe(false);
    }
    expect(needsTouch(stale, now)).toBe(true);
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
  });

  it("returns non-secure cookie in development", () => {
    process.env.NODE_ENV = "development";
    const opts = buildCookieOptions();
    expect(opts.secure).toBe(false);
  });

  // `strict` withholds the cookie on top-level navigation from any other
  // origin, which renders the app logged-out on arrival from a link.
  it("uses SameSite=lax so arriving from an external link keeps the session", () => {
    expect(buildCookieOptions().sameSite).toBe("lax");
  });

  // Without maxAge the cookie is a browser-session cookie and is dropped when
  // the browser closes, no matter how long the server-side session is good for.
  it("carries an explicit lifetime so it survives a browser restart", () => {
    const opts = buildCookieOptions();
    expect(opts.maxAge).toBeGreaterThan(24 * 60 * 60 * 1000);
  });
});

describe("buildClearCookieOptions", () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  // A __Host- cookie is only removed when the clearing Set-Cookie repeats the
  // attributes it was written with, Secure included.
  it("mirrors the set attributes so the browser accepts the removal", () => {
    process.env.NODE_ENV = "production";
    const set = buildCookieOptions();
    const clear = buildClearCookieOptions();

    expect(clear.secure).toBe(set.secure);
    expect(clear.httpOnly).toBe(set.httpOnly);
    expect(clear.sameSite).toBe(set.sameSite);
    expect(clear.path).toBe(set.path);
  });

  it("omits maxAge, which express replaces with an expiry in the past", () => {
    expect("maxAge" in buildClearCookieOptions()).toBe(false);
  });
});
