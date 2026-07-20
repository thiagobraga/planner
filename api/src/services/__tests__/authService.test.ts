import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

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
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    incr: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(1),
    isReady: true,
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$mocked_hash"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../sessionService.js", () => ({
  createSession: vi.fn().mockResolvedValue("mock-raw-session-token"),
}));

vi.mock("../../utils/AppError.js", () => ({
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    details: unknown;
    constructor(opts: { code: string; message: string; statusCode: number; details?: unknown }) {
      super(opts.message);
      this.code = opts.code;
      this.statusCode = opts.statusCode;
      this.details = opts.details;
    }
  },
}));

import { register, login, requestPasswordReset, confirmPasswordReset } from "../authService.js";

const STRONG_PASSWORD = "correct-horse-battery-staple";

beforeEach(() => {
  vi.clearAllMocks();
  mockClientQuery.mockResolvedValue({ rows: [] });
});

describe("register - validation", () => {
  it("rejects invalid email format", async () => {
    try {
      await register({ email: "not-an-email", password: STRONG_PASSWORD, displayName: "Test" });
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

  it("rejects short password", async () => {
    try {
      await register({ email: "test@example.com", password: "short", displayName: "Test" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects weak password", async () => {
    try {
      await register({ email: "test@example.com", password: "password12345678", displayName: "Test" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects display name outside 1-50 chars", async () => {
    try {
      await register({ email: "test@example.com", password: STRONG_PASSWORD, displayName: "" });
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

    try {
      await register({ email: "test@example.com", password: STRONG_PASSWORD, displayName: "a".repeat(51) });
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
      await register({ email: "bad", password: "sh", displayName: "" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("rejects duplicate email with EMAIL_IN_USE", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing-user" }] });

    try {
      await register({ email: "taken@example.com", password: STRONG_PASSWORD, displayName: "Test" });
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("EMAIL_IN_USE");
      expect(e.statusCode).toBe(409);
    }
  });
});

describe("login", () => {
  it("returns user and raw session token on success", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: "user-1", email: "user@example.com", password_hash: "$2b$hash", display_name: "User" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await login("user@example.com", STRONG_PASSWORD);

    expect(result.user).toEqual({ id: "user-1", email: "user@example.com", displayName: "User" });
    expect(result.rawToken).toBe("mock-raw-session-token");
  });
});

describe("login - rate limiting", () => {
  it("returns RATE_LIMITED after 10+ failed attempts", async () => {
    const { redisClient } = await import("../../db/redis.js");
    (redisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue("11");

    try {
      await login("user@example.com", "doesnotmatter");
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("RATE_LIMITED");
      expect(e.statusCode).toBe(429);
    }
  });

  it("skips the login throttle in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "test-secret-not-for-prod");
    vi.stubEnv("CSRF_SECRET", "a".repeat(32));
    vi.stubEnv("DATABASE_URL", "postgres://planner:planner@localhost:5432/planner");
    vi.stubEnv("CORS_ORIGIN", "http://localhost:5173");
    try {
      vi.resetModules();

      const { login: devLogin } = await import("../authService.js");
      const { redisClient } = await import("../../db/redis.js");

      (redisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue("11");
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: "user-1", email: "user@example.com", password_hash: "$2b$hash", display_name: "User" }],
        })
        .mockResolvedValueOnce({ rows: [] });

      await devLogin("user@example.com", STRONG_PASSWORD);

      expect(redisClient.get).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      await import("../authService.js");
    }
  });
});

describe("confirmPasswordReset - token lifecycle", () => {
  it("rejects expired token (after 60 minutes)", async () => {
    const expiredDate = new Date(Date.now() - 1000);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "token-1", user_id: "user-1", expires_at: expiredDate.toISOString(), used_at: null }],
    });

    try {
      await confirmPasswordReset("some-token", STRONG_PASSWORD);
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
      await confirmPasswordReset("some-token", STRONG_PASSWORD);
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("TOKEN_INVALID");
      expect(e.statusCode).toBe(400);
    }
  });

  it("rejects invalid token (not found in DB)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    try {
      await confirmPasswordReset("nonexistent-token", STRONG_PASSWORD);
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("TOKEN_INVALID");
    }
  });

  it("succeeds and updates password, removes token", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "token-1", user_id: "user-1", expires_at: futureDate.toISOString(), used_at: null }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update password
    mockQuery.mockResolvedValueOnce({ rows: [] }); // mark token used
    mockQuery.mockResolvedValueOnce({ rows: [] }); // revoke sessions

    const result = await confirmPasswordReset("valid-token", STRONG_PASSWORD);
    expect(result.success).toBe(true);
  });
});

describe("requestPasswordReset", () => {
  it("returns success for existing email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "user-1", email: "user@example.com" }] });

    const result = await requestPasswordReset("user@example.com");
    expect(result.message).toBe("If an account exists, a reset email has been sent");
  });

  it("returns same message for non-existent email (no info leak)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await requestPasswordReset("nonexistent@example.com");
    expect(result.message).toBe("If an account exists, a reset email has been sent");
  });
});
