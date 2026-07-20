import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";
import { AppError } from "../../utils/AppError.js";

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockConfirmPasswordReset = vi.fn();
const mockValidate = vi.fn((errors: unknown[]) => {
  if (errors.length > 0) {
    const err = new Error("Validation failed") as Error & { code: string; statusCode: number };
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }
});
const mockRevokeSession = vi.fn();
const mockBuildCookieName = vi.fn();
const mockBuildCookieOptions = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock("../../services/authService.js", () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  confirmPasswordReset: (...args: unknown[]) => mockConfirmPasswordReset(...args),
}));

vi.mock("../../utils/validate.js", () => ({
  validate: (...args: unknown[]) => mockValidate(...args),
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
  buildCookieName: (...args: unknown[]) => mockBuildCookieName(...args),
  buildCookieOptions: (...args: unknown[]) => mockBuildCookieOptions(...args),
}));

vi.mock("../../db/pool.js", () => ({
  default: { query: (...args: unknown[]) => mockPoolQuery(...args) },
}));

import authRoutes from "../auth.js";

const app = createApp(authRoutes, "/api/v1/auth");

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildCookieName.mockReturnValue("planner_session");
  mockBuildCookieOptions.mockReturnValue({ httpOnly: true, secure: false, sameSite: "strict", path: "/" });
  mockValidate.mockImplementation((errors: { field: string; message: string }[]) => {
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

  it("POST /api/v1/auth/logout → calls revokeSession, clears cookie", async () => {
    mockRevokeSession.mockResolvedValue(undefined);
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
    expect(mockRevokeSession).toHaveBeenCalledWith(42);
  });

  it("POST /api/v1/auth/reset-password → calls requestPasswordReset", async () => {
    mockRequestPasswordReset.mockResolvedValue({ message: "sent" });
    const res = await request(app).post("/api/v1/auth/reset-password").send({ email: "a@b.com" });
    expect(res.status).toBe(200);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith("a@b.com");
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
