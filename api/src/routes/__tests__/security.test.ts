import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";


vi.mock("../../services/sessionService.js", () => ({
  validateSession: vi.fn(),
  shouldTouch: vi.fn().mockReturnValue(false),
  buildCookieName: vi.fn().mockReturnValue("planner_session"),
  buildCookieOptions: vi.fn().mockReturnValue({
    httpOnly: true,
    secure: false,
    sameSite: "strict" as const,
    path: "/",
  }),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
  generateRawToken: () => "raw-token",
  hashToken: (raw: string) => raw,
}));

vi.mock("../../services/authService.js", () => ({
  login: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string; sessionId?: number }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    req.sessionId = 1;
    next();
  },
}));

vi.mock("../../services/rateLimitService.js", () => ({
  checkLoginRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfterSeconds: 0 }),
  checkRegistrationRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 3, retryAfterSeconds: 0 }),
  checkPasswordResetRate: vi.fn().mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 }),
  incrementLoginAttempts: vi.fn(),
  clearLoginRate: vi.fn(),
  incrementRegistrationAttempts: vi.fn(),
  incrementPasswordResetAttempts: vi.fn(),
  getProgressiveDelay: vi.fn().mockReturnValue(0),
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), incr: vi.fn(), expire: vi.fn(), del: vi.fn(), isReady: false },
  redisPubClient: { publish: vi.fn() },
  redisSubClient: { subscribe: vi.fn() },
}));

vi.mock("../../db/pool.js", () => ({
  default: { query: vi.fn() },
}));

import { login } from "../../services/authService.js";
import { checkLoginRate } from "../../services/rateLimitService.js";
import { buildCookieName, buildCookieOptions } from "../../services/sessionService.js";

let app: Express;

beforeAll(async () => {
  const express = (await import("express")).default;
  const helmet = (await import("helmet")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const crypto = (await import("node:crypto")).default;

  app = express();
  app.set("trust proxy", 0);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        reportUri: "/api/v1/csp-violation",
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: { policy: "require-corp" },
  }));

  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    next();
  });

  app.use(cookieParser());

  app.use((_req, res, next) => {
    res.setHeader("X-Request-Id", crypto.randomUUID());
    next();
  });

  app.use(express.json());

  // Non-JSON content-type guard
  app.use("/api/v1", (req, _res, next) => {
    if (req.path.startsWith("/auth")) {
      next();
      return;
    }
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const ct = req.headers["content-type"] ?? "";
      if (!ct.startsWith("application/json")) {
        _res.status(415).json({
          error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Only application/json is accepted" },
        });
        return;
      }
    }
    next();
  });

  const authRoutes = (await import("../auth.js")).default;
  app.use("/api/v1/auth", authRoutes);

  const { originCheck } = await import("../../middleware/origin.js");
  app.use("/api/v1", originCheck);

  app.use("/api/v1", (req, _res, next) => {
    if (req.path.startsWith("/auth") || req.path === "/health") {
      next();
      return;
    }
    req.userId = "test-user";
    req.sessionId = 1;
    next();
  });

  const { csrfProtection } = await import("../../middleware/csrf.js");
  app.use("/api/v1", csrfProtection);

  app.use("/api/v1", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });

  const mainRouter = (await import("../index.js")).default;
  app.use("/api/v1", mainRouter);

  const { notFound } = await import("../../middleware/notFound.js");
  app.use(notFound);

  const { errorHandler } = await import("../../middleware/errorHandler.js");
  app.use(errorHandler);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("security headers", () => {
  it("includes X-Request-Id on every response", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(/^[a-f0-9-]+$/);
  });

  it("sets Cache-Control: private, no-store on API responses", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("includes X-Frame-Options from Helmet", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("includes X-Content-Type-Options from Helmet", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("includes frame-ancestors CSP directive", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("includes CSP report-uri directive", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["content-security-policy"]).toContain("report-uri /api/v1/csp-violation");
  });

  it("includes Permissions-Policy header restricting sensitive features", async () => {
    const res = await request(app).get("/api/v1/health");
    const pp = res.headers["permissions-policy"] as string;
    expect(pp).toBeDefined();
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
    expect(pp).toContain("payment=()");
  });

  it("includes Cross-Origin-Opener-Policy: same-origin", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
  });

  it("includes Cross-Origin-Embedder-Policy: require-corp", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["cross-origin-embedder-policy"]).toBe("require-corp");
  });

  it("rejects oversized request bodies", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ data: "x".repeat(200 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe("auth route security", () => {
  it("login returns user data only (no token in JSON)", async () => {
    vi.mocked(login).mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.com", displayName: null },
      rawToken: "session-abc",
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.com", password: "correct-horse-battery-staple" });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe("u1");
    expect(res.body.token).toBeUndefined();
    expect(res.body.rawToken).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
  });

  it("login sets a session cookie", async () => {
    vi.mocked(login).mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.com", displayName: null },
      rawToken: "session-abc",
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.com", password: "correct-horse-battery-staple" });

    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    const sessionCookie = cookies.find((c: string) => c.startsWith("planner_session"));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Strict");
  });

  it("logout clears the session cookie", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    const clearCookie = cookies.find((c: string) => c.includes("planner_session=;"));
    expect(clearCookie).toBeDefined();
  });
});

describe("CSRF protection", () => {
  it("unsafe request without CSRF token returns 403", async () => {
    const res = await request(app)
      .post("/api/v1/tasks")
      .send({ title: "test" })
      .set("Cookie", "planner_csrf=token:hmac");

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("CSRF_INVALID");
  });

  it("safe methods (GET) do not require CSRF", async () => {
    const res = await request(app).get("/api/v1/tasks");
    expect(res.status).not.toBe(403);
  });
});

describe("rate limiting", () => {
  it("login route checks rate limit before processing", async () => {
    vi.mocked(login).mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.com", displayName: null },
      rawToken: "session-abc",
    });

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.com", password: "correct-horse-battery-staple" });

    expect(checkLoginRate).toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkLoginRate).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900,
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.com", password: "correct-horse-battery-staple" });

    expect(res.status).toBe(429);
    expect(res.body.error?.code).toBe("RATE_LIMITED");
  });
});

describe("error response shape", () => {
  it("returns structured error for invalid routes", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBeDefined();
    expect(res.body.error.message).toBeDefined();
  });

  it("does not leak stack traces in error responses", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.text).not.toContain("Error:");
    expect(res.text).not.toContain("at ");
  });
});

describe("content-type enforcement", () => {
  it("rejects POST with non-JSON content-type", async () => {
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("title=test");
    expect(res.status).toBe(415);
    expect(res.body.error?.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects PATCH with non-JSON content-type", async () => {
    const res = await request(app)
      .patch("/api/v1/tasks/t1")
      .set("Content-Type", "text/plain")
      .send("some text");
    expect(res.status).toBe(415);
  });

  it("allows POST with JSON content-type", async () => {
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Content-Type", "application/json")
      .send({ title: "test" });
    expect(res.status).not.toBe(415);
  });

  it("allows GET without content-type", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).not.toBe(415);
  });
});

describe("HSTS header", () => {
  it("includes Strict-Transport-Security via Helmet", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
  });
});
