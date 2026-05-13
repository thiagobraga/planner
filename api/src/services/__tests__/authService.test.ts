import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

// Mock pool
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

// Mock redis
const mockRedisGet = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisDel = vi.fn();

vi.mock("../../db/redis.js", () => ({
  redisClient: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
}));

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

import { register, login, confirmPasswordReset } from "../authService.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockClientQuery.mockResolvedValue({ rows: [] });
});

describe("register - validation", () => {
  it("rejects invalid email format", async () => {
    try {
      await register({ email: "not-an-email", password: "12345678", displayName: "Test" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "email" }),
        ])
      );
    }
  });

  it("rejects password shorter than 8 chars", async () => {
    try {
      await register({ email: "test@example.com", password: "short", displayName: "Test" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "password" }),
        ])
      );
    }
  });

  it("rejects display name outside 1-50 chars", async () => {
    try {
      await register({ email: "test@example.com", password: "12345678", displayName: "" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "displayName" }),
        ])
      );
    }

    // Too long
    try {
      await register({ email: "test@example.com", password: "12345678", displayName: "a".repeat(51) });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "displayName" }),
        ])
      );
    }
  });

  it("returns all validation errors in single response", async () => {
    try {
      await register({ email: "bad", password: "short", displayName: "" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details).toHaveLength(3);
    }
  });

  it("rejects duplicate email with EMAIL_IN_USE", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing-user" }] });

    try {
      await register({ email: "taken@example.com", password: "12345678", displayName: "Test" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("EMAIL_IN_USE");
      expect(e.statusCode).toBe(409);
    }
  });
});

describe("login - rate limiting", () => {
  it("returns RATE_LIMITED after 10+ failed attempts", async () => {
    mockRedisGet.mockResolvedValue("11");

    try {
      await login("user@example.com", "password123");
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("RATE_LIMITED");
      expect(e.statusCode).toBe(429);
    }
  });

  it("resets counter on successful login", async () => {
    mockRedisGet.mockResolvedValue("3");
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: "user-1", email: "user@example.com", password_hash: "hash", display_name: "User" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // session insert

    const { default: bcrypt } = await import("bcrypt");
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    await login("user@example.com", "correctpassword");

    expect(mockRedisDel).toHaveBeenCalledWith("login_attempts:user@example.com");
  });
});

describe("confirmPasswordReset - token lifecycle", () => {
  it("rejects expired token (after 60 minutes)", async () => {
    const expiredDate = new Date(Date.now() - 1000); // 1 second ago
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "token-1", user_id: "user-1", expires_at: expiredDate.toISOString(), used_at: null }],
    });

    try {
      await confirmPasswordReset("some-token", "newpassword123");
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("TOKEN_INVALID");
      expect(e.statusCode).toBe(400);
    }
  });

  it("rejects used token", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "token-1", user_id: "user-1", expires_at: futureDate.toISOString(), used_at: new Date().toISOString() }],
    });

    try {
      await confirmPasswordReset("some-token", "newpassword123");
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("TOKEN_INVALID");
      expect(e.statusCode).toBe(400);
    }
  });
});
