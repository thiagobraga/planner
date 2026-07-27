import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();
const mockRevokeAllUserSessions = vi.fn();
const mockSessionRevoked = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("../sessionService.js", () => ({
  revokeAllUserSessions: (...args: unknown[]) => mockRevokeAllUserSessions(...args),
}));

vi.mock("../../utils/securityLogger.js", () => ({
  securityLog: {
    sessionRevoked: (...args: unknown[]) => mockSessionRevoked(...args),
  },
}));

import {
  listUsers,
  disableUser,
  enableUser,
  revokeSessions,
} from "../adminUserService.js";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "user@example.com",
    display_name: "User",
    role: "user",
    created_at: CREATED_AT,
    disabled_at: null,
    last_seen_at: null,
    active_sessions: "0",
    ...overrides,
  };
}

/** SQL text of the nth pool.query call, whitespace-collapsed. */
function sqlOf(callIndex: number): string {
  return String(mockQuery.mock.calls[callIndex]?.[0] ?? "").replace(/\s+/g, " ");
}

function paramsOf(callIndex: number): unknown[] {
  return (mockQuery.mock.calls[callIndex]?.[1] ?? []) as unknown[];
}

beforeEach(() => {
  mockQuery.mockReset();
  mockRevokeAllUserSessions.mockReset();
  mockSessionRevoked.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockRevokeAllUserSessions.mockResolvedValue(undefined);
});

describe("listUsers", () => {
  it("maps rows to camelCase with ISO dates", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        userRow({
          disabled_at: new Date("2026-02-02T10:00:00.000Z"),
          last_seen_at: new Date("2026-02-03T11:00:00.000Z"),
          active_sessions: "3",
        }),
      ],
    });

    const result = await listUsers();

    expect(result.users).toEqual([
      {
        id: "u1",
        email: "user@example.com",
        displayName: "User",
        role: "user",
        createdAt: "2026-01-01T00:00:00.000Z",
        disabledAt: "2026-02-02T10:00:00.000Z",
        lastSeenAt: "2026-02-03T11:00:00.000Z",
        activeSessions: 3,
      },
    ]);
  });

  it("searches email and display name with a wildcard ILIKE", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listUsers({ search: "  ana  " });

    expect(sqlOf(0)).toContain("u.email ILIKE $1 OR u.display_name ILIKE $1");
    expect(paramsOf(0)[0]).toBe("%ana%");
  });

  it("filters on nothing when no search or cursor is given", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listUsers();

    // The lateral join carries its own WHERE, so assert on the outer filter:
    // the only bound parameter left is the page size.
    expect(sqlOf(0)).not.toContain("ILIKE");
    expect(sqlOf(0)).not.toContain("(u.created_at, u.id) <");
    expect(paramsOf(0)).toHaveLength(1);
  });

  it("returns a cursor only when more rows exist than the page holds", async () => {
    const rows = Array.from({ length: 3 }, (_unused, i) => userRow({ id: `u${i}` }));
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await listUsers({ limit: 2 });

    expect(result.users).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
    // limit + 1 is requested so the extra row can signal "there is more".
    expect(paramsOf(0).at(-1)).toBe(3);
  });

  it("returns a null cursor on the last page", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [userRow()] });

    const result = await listUsers({ limit: 2 });

    expect(result.nextCursor).toBeNull();
  });

  it("resumes from a cursor produced by the previous page", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [userRow({ id: "a" }), userRow({ id: "b" })],
    });
    const first = await listUsers({ limit: 1 });

    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listUsers({ limit: 1, cursor: first.nextCursor! });

    expect(sqlOf(1)).toContain("(u.created_at, u.id) <");
    expect(paramsOf(1).slice(0, 2)).toEqual(["2026-01-01T00:00:00.000Z", "a"]);
  });

  it("rejects a malformed cursor", async () => {
    await expect(listUsers({ cursor: "not-a-real-cursor" })).rejects.toThrow(AppError);
  });

  it("clamps the page size to the maximum", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listUsers({ limit: 5000 });

    expect(paramsOf(0).at(-1)).toBe(101);
  });
});

describe("disableUser", () => {
  it("stamps disabled_at, revokes sessions and logs the revocation", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "u2" }] });
    mockQuery.mockResolvedValueOnce({
      rows: [userRow({ id: "u2", disabled_at: new Date("2026-03-01T00:00:00.000Z") })],
    });

    const result = await disableUser("admin-1", "u2");

    expect(sqlOf(0)).toContain("SET disabled_at = NOW()");
    expect(mockRevokeAllUserSessions).toHaveBeenCalledWith("u2", "admin-disable");
    expect(mockSessionRevoked).toHaveBeenCalledWith("u2", "admin-disable", "admin-1");
    expect(result.disabledAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("refuses to disable the acting admin's own account", async () => {
    await expect(disableUser("admin-1", "admin-1")).rejects.toMatchObject({
      code: "CANNOT_DISABLE_SELF",
      statusCode: 400,
    });
    expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("is a no-op that returns the user when already disabled", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({
      rows: [userRow({ id: "u2", disabled_at: new Date("2026-03-01T00:00:00.000Z") })],
    });

    const result = await disableUser("admin-1", "u2");

    expect(result.disabledAt).toBe("2026-03-01T00:00:00.000Z");
    expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("404s for an unknown user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(disableUser("admin-1", "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});

describe("enableUser", () => {
  it("clears disabled_at without touching sessions", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "u2" }] });
    mockQuery.mockResolvedValueOnce({ rows: [userRow({ id: "u2", disabled_at: null })] });

    const result = await enableUser("admin-1", "u2");

    expect(sqlOf(0)).toContain("SET disabled_at = NULL");
    expect(result.disabledAt).toBeNull();
    expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("404s for an unknown user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(enableUser("admin-1", "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});

describe("revokeSessions", () => {
  it("revokes sessions and leaves disabled_at alone", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [userRow({ id: "u2", active_sessions: "4" })],
    });

    const result = await revokeSessions("admin-1", "u2");

    expect(mockRevokeAllUserSessions).toHaveBeenCalledWith("u2", "admin-revoke");
    expect(mockSessionRevoked).toHaveBeenCalledWith("u2", "admin-revoke", "admin-1");
    expect(result.disabledAt).toBeNull();
    expect(result.activeSessions).toBe(0);
    expect(mockQuery.mock.calls.every((call) => !String(call[0]).includes("disabled_at ="))).toBe(
      true,
    );
  });

  it("404s for an unknown user before revoking anything", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(revokeSessions("admin-1", "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
    expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
  });
});
