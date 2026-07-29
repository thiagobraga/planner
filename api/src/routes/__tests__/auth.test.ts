import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";
import { AppError } from "../../utils/AppError.js";
import type { ValidationError } from "../../utils/validate.js";

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockConfirmPasswordReset = vi.fn();
const mockValidate = vi.fn((errors: ValidationError[]) => {
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { code: string; statusCode: number };
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
});
const mockRevokeSession = vi.fn();
const mockValidateSession = vi.fn();
const mockBuildCookieName = vi.fn();
const mockBuildCookieOptions = vi.fn();
const mockBuildClearCookieOptions = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock("../../services/authService.js", () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  confirmPasswordReset: (...args: unknown[]) => mockConfirmPasswordReset(...args),
}));

vi.mock("../../utils/validate.js", () => ({
  validate: (errors: ValidationError[]) => mockValidate(errors),
}));

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string; sessionId?: number }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    req.sessionId = 42;
    next();
  },
}));

vi.mock("../../services/sessionService.js", () => ({
  revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
  buildCookieName: (...args: unknown[]) => mockBuildCookieName(...args),
  buildCookieOptions: (...args: unknown[]) => mockBuildCookieOptions(...args),
  buildClearCookieOptions: (...args: unknown[]) => mockBuildClearCookieOptions(...args),
}));

vi.mock("../../db/pool.js", () => ({
  default: { query: (...args: unknown[]) => mockPoolQuery(...args) },
}));

vi.mock("../../services/rateLimitService.js", () => ({
  checkLoginRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfterSeconds: 0 }),
  checkRegistrationRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 3, retryAfterSeconds: 0 }),
  checkPasswordResetRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 }),
  incrementPasswordResetAttempts: vi.fn().mockResolvedValue(undefined),
  incrementRegistrationAttempts: vi.fn().mockResolvedValue(undefined),
}));

import authRoutes from "../auth.js";

const app = createApp(authRoutes, "/api/v1/auth");

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildCookieName.mockReturnValue("planner_session");
  mockBuildCookieOptions.mockReturnValue({ httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 1000 });
  mockBuildClearCookieOptions.mockReturnValue({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
  mockValidateSession.mockResolvedValue({ userId: "test-user", sessionId: 42, lastSeenAt: null });
  mockValidate.mockImplementation((errors: ValidationError[]) => {
    if (errors.length > 0) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Validation failed", statusCode: 400, details: errors });
    }
  });
});

describe("auth routes", () => {
  it("POST /api/v1/auth/register → calls register, returns 201", async () => {
    mockRegister.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const res = await request(app).post("/api/v1/auth/register").send({ email: "a@b.com", password: "test123" });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe("u1");
  });

  it("POST /api/v1/auth/register → forwards displayName to register()", async () => {
    mockRegister.mockResolvedValue({ id: "u1", email: "a@b.com", displayName: "Alice" });
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "a@b.com", password: "test123", displayName: "Alice" });
    expect(res.status).toBe(201);
    expect(mockRegister).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "test123",
      displayName: "Alice",
    });
  });

  it("POST /api/v1/auth/register without displayName → forwards undefined", async () => {
    mockRegister.mockResolvedValue({ id: "u1", email: "a@b.com", displayName: null });
    await request(app).post("/api/v1/auth/register").send({ email: "a@b.com", password: "test123" });
    expect(mockRegister).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "test123",
      displayName: undefined,
    });
  });

  it("POST /api/v1/auth/register → counts the attempt only on success", async () => {
    const rateLimitMock = await import("../../services/rateLimitService.js");
    const increment = rateLimitMock.incrementRegistrationAttempts as ReturnType<typeof vi.fn>;

    mockRegister.mockResolvedValue({ id: "u1", email: "a@b.com" });
    await request(app).post("/api/v1/auth/register").send({ email: "a@b.com", password: "test123" });
    expect(increment).toHaveBeenCalledTimes(1);

    increment.mockClear();
    mockRegister.mockRejectedValueOnce(
      new AppError({ code: "EMAIL_IN_USE", message: "taken", statusCode: 409 }),
    );
    await request(app).post("/api/v1/auth/register").send({ email: "a@b.com", password: "test123" });
    expect(increment).not.toHaveBeenCalled();
  });

  it("POST /api/v1/auth/register → 429 carries retryAfterSeconds", async () => {
    const rateLimitMock = await import("../../services/rateLimitService.js");
    (rateLimitMock.checkRegistrationRate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 3600,
    });

    const res = await request(app).post("/api/v1/auth/register").send({ email: "a@b.com", password: "test123" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(res.body.error.retryAfterSeconds).toBe(3600);
    expect(res.headers["retry-after"]).toBe("3600");
  });

  it("POST /api/v1/auth/login → calls login, sets cookie", async () => {
    mockLogin.mockResolvedValue({ user: { id: "u1" }, rawToken: "token123" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "a@b.com", password: "test123" });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("u1");
    expect((res.headers["set-cookie"] as unknown as string[])[0]).toContain("planner_session=token123");
  });

  it("POST /api/v1/auth/login with missing email → 400", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ password: "test123" });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/auth/login → 429 when rate limited", async () => {
    const rateLimitMock = await import("../../services/rateLimitService.js");
    (rateLimitMock.checkLoginRate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900,
    });

    const res = await request(app).post("/api/v1/auth/login").send({ email: "a@b.com", password: "test123" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(res.body.error.retryAfterSeconds).toBe(900);
    expect(res.headers["retry-after"]).toBe("900");
  });

  it("POST /api/v1/auth/logout → calls revokeSession, clears cookie", async () => {
    mockRevokeSession.mockResolvedValue(undefined);
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", "planner_session=raw-token");
    expect(res.status).toBe(200);
    expect(mockRevokeSession).toHaveBeenCalledWith(42);
  });

  // The whole point of logging out is to end a session. A dead one is already
  // in the desired state, and returning 401 there made the browser log an error
  // on every expiry - on the one request meant to clean that expiry up.
  it("POST /api/v1/auth/logout → 200 when the session has already expired", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", "planner_session=stale-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it("POST /api/v1/auth/logout → 200 when no session cookie was sent at all", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    expect(res.status).toBe(200);
    expect(mockValidateSession).not.toHaveBeenCalled();
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it("POST /api/v1/auth/logout → clears the session cookie with the attributes it was set with", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", "planner_session=raw-token");

    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    const cleared = cookies.find((c) => c.startsWith("planner_session=;"));
    expect(cleared).toBeDefined();
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("Path=/");
  });

  // Left behind, it keeps being echoed in X-XSRF-TOKEN and stays bound to a
  // session id that no longer exists.
  it("POST /api/v1/auth/logout → clears the CSRF cookie too", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", "planner_session=raw-token");

    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    expect(cookies.some((c) => c.startsWith("planner_csrf=;"))).toBe(true);
  });

  it("POST /api/v1/auth/reset-password → calls requestPasswordReset", async () => {
    mockRequestPasswordReset.mockResolvedValue({ message: "sent" });
    const res = await request(app).post("/api/v1/auth/reset-password").send({ email: "a@b.com" });
    expect(res.status).toBe(200);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith("a@b.com");
  });

  it("POST /api/v1/auth/reset-password → 429 carries retryAfterSeconds", async () => {
    const rateLimitMock = await import("../../services/rateLimitService.js");
    (rateLimitMock.checkPasswordResetRate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 3600,
    });

    const res = await request(app).post("/api/v1/auth/reset-password").send({ email: "a@b.com" });
    expect(res.status).toBe(429);
    expect(res.body.error.retryAfterSeconds).toBe(3600);
    expect(res.headers["retry-after"]).toBe("3600");
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("POST /api/v1/auth/reset-password/confirm → calls confirmPasswordReset", async () => {
    mockConfirmPasswordReset.mockResolvedValue({ success: true });
    const res = await request(app).post("/api/v1/auth/reset-password/confirm").send({ token: "abc", newPassword: "newpass" });
    expect(res.status).toBe(200);
    expect(mockConfirmPasswordReset).toHaveBeenCalledWith("abc", "newpass");
  });

  it("POST /api/v1/auth/reset-password/confirm without token → 400", async () => {
    const res = await request(app).post("/api/v1/auth/reset-password/confirm").send({ newPassword: "newpass" });
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/auth/me → returns user from pool.query", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ id: "u1", email: "a@b.com", display_name: "Alice" }] });
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Alice");
  });
});
