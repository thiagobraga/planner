import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { createHash } from "node:crypto";
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
  redisPubClient: {
    publish: vi.fn(),
  },
}));

vi.mock("../sessionService.js", () => ({
  createSession: vi.fn().mockResolvedValue("mock-raw-session-token"),
}));

vi.mock("../rateLimitService.js", () => ({
  checkLoginRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfterSeconds: 0 }),
  incrementLoginAttempts: vi.fn().mockResolvedValue(undefined),
  clearLoginRate: vi.fn().mockResolvedValue(undefined),
  checkRegistrationRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 3, retryAfterSeconds: 0 }),
  checkPasswordResetRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 }),
  incrementPasswordResetAttempts: vi.fn().mockResolvedValue(undefined),
  getProgressiveDelay: vi.fn().mockReturnValue(0),
}));

const mockSendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);

vi.mock("../emailService.js", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config.js")>()),
  CORS_ORIGIN: "https://planner.test",
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
import { hashPassword } from "../passwordService.js";

const STRONG_PASSWORD = "correct-horse-battery-staple";
let validHash: string;

beforeAll(async () => {
  validHash = await hashPassword(STRONG_PASSWORD);
});

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks leaves queued mockResolvedValueOnce values in place, so an
  // unconsumed one from an earlier test would be handed to the next one's
  // first query. Drain the queue explicitly.
  mockQuery.mockReset();
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
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "user-1", email: "user@example.com", password_hash: validHash, display_name: "User" }],
    });

    const result = await login("user@example.com", STRONG_PASSWORD);

    expect(result.user).toEqual({ id: "user-1", email: "user@example.com", displayName: "User" });
    expect(result.rawToken).toBe("mock-raw-session-token");
  });
});

describe("login - rate limiting", () => {
  it("returns RATE_LIMITED when checkLoginRate returns disallowed", async () => {
    const rateLimitMock = await import("../rateLimitService.js");
    (rateLimitMock.checkLoginRate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900,
    });

    try {
      await login("user@example.com", "doesnotmatter");
      expect.fail("should throw");
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe("RATE_LIMITED");
      expect(e.statusCode).toBe(429);
    }
  });

  it("increments attempts on failed login (user not found)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const rateLimitMock = await import("../rateLimitService.js");

    try {
      await login("nonexistent@example.com", "somepassword");
      expect.fail("should throw");
    } catch {
      expect(rateLimitMock.incrementLoginAttempts).toHaveBeenCalled();
    }
  });

  it("clears rate limit on successful login", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "user-1", email: "user@example.com", password_hash: validHash, display_name: "User" }],
    });

    const rateLimitMock = await import("../rateLimitService.js");

    await login("user@example.com", STRONG_PASSWORD);
    expect(rateLimitMock.clearLoginRate).toHaveBeenCalled();
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
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("sends a reset link built from CORS_ORIGIN carrying the raw token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "user-1", email: "user@example.com" }] });

    await requestPasswordReset("user@example.com");

    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [email, link] = mockSendPasswordResetEmail.mock.calls[0] as [string, string];
    expect(email).toBe("user@example.com");
    expect(link).toMatch(/^https:\/\/planner\.test\/reset-password\?token=[a-f0-9]{64}$/);
  });

  it("stores only the hash of the token it emails", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "user-1", email: "user@example.com" }] });

    await requestPasswordReset("user@example.com");

    const [, link] = mockSendPasswordResetEmail.mock.calls[0] as [string, string];
    const rawToken = new URL(link).searchParams.get("token")!;
    const insertParams = mockQuery.mock.calls[1][1] as string[];
    expect(insertParams[1]).toBe(createHash("sha256").update(rawToken).digest("hex"));
    expect(insertParams).not.toContain(rawToken);
  });
});
