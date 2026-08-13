import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import type { Request, Response, NextFunction } from "express";

// vi.mock factories are hoisted above the module body, so a shared helper has to
// be declared with vi.hoisted() to exist by the time a factory runs.
const { passthrough } = vi.hoisted(() => ({
  passthrough: () =>
    vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock("redis", () => ({
  createClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    subscribe: vi.fn(),
    psubscribe: vi.fn(),
    isReady: false,
  }),
}));

vi.mock("../services/syncService.js", () => ({
  attachSyncServer: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.userId = "test-user";
    req.sessionId = 1;
    next();
  }),
}));

vi.mock("../middleware/csrf.js", () => ({
  csrfProtection: passthrough(),
}));

vi.mock("../middleware/origin.js", () => ({
  originCheck: passthrough(),
}));

vi.mock("../middleware/errorHandler.js", () => ({
  errorHandler: vi.fn(
    (_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    },
  ),
}));

vi.mock("../middleware/notFound.js", () => ({
  notFound: vi.fn((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND" } });
  }),
}));

vi.mock("../routes/auth.js", () => ({ default: passthrough() }));

vi.mock("../routes/tasks.js", () => ({
  default: vi.fn((_req: Request, _res: Response, next: NextFunction) =>
    next(new Error("Test error")),
  ),
}));
vi.mock("../routes/labels.js", () => ({ default: passthrough() }));
vi.mock("../routes/collections.js", () => ({ default: passthrough() }));
vi.mock("../routes/sections.js", () => ({ default: passthrough() }));
vi.mock("../routes/views.js", () => ({ default: passthrough() }));
vi.mock("../routes/filters.js", () => ({ default: passthrough() }));
vi.mock("../routes/search.js", () => ({ default: passthrough() }));
vi.mock("../routes/reminders.js", () => ({
  default: passthrough(),
  taskReminderRouter: passthrough(),
}));
vi.mock("../routes/comments.js", () => ({
  default: passthrough(),
  taskCommentRouter: passthrough(),
}));
vi.mock("../routes/preferences.js", () => ({ default: passthrough() }));
vi.mock("../routes/habits.js", () => ({ default: passthrough() }));
vi.mock("../routes/habitGroups.js", () => ({ default: passthrough() }));
vi.mock("../routes/activity.js", () => ({ default: passthrough() }));
vi.mock("../routes/collaboration.js", () => ({
  default: passthrough(),
  collectionCollabRouter: passthrough(),
}));

import app from "../index.js";

describe("Express app setup", () => {
  it("GET /api/v1/health returns { status: 'ok' }", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api/v1/version returns the build version with no auth required", async () => {
    const res = await request(app).get("/api/v1/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ current: expect.any(String), latest: expect.any(String) });
  });

  it("GET /api/v1/nonexistent returns 404", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "NOT_FOUND");
  });

  it("error handler catches errors", async () => {
    const res = await request(app).get("/api/v1/tasks");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "INTERNAL_ERROR");
  });

  it("rejects non-JSON content-type on unsafe methods with 415", async () => {
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Content-Type", "text/plain")
      .send("title=plain");
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("does not apply the 415 gate on /auth paths", async () => {
    // /auth is deliberately exempt: the handlers validate their fields
    // themselves, and since no urlencoded parser is mounted, a form-encoded
    // body never parses - real routes answer 400 VALIDATION_ERROR, never 415.
    // With the auth router stubbed as a passthrough, the request falls through
    // to notFound, so only the gate's non-application is asserted here.
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "text/plain")
      .send("email=x@example.com");
    expect(res.status).not.toBe(415);
  });

  it("answers OPTIONS preflight requests with 204", async () => {
    const res = await request(app).options("/api/v1/tasks");
    expect(res.status).toBe(204);
  });

  it("allows non-JSON content-type on GET requests", async () => {
    const res = await request(app)
      .get("/api/v1/labels")
      .set("Content-Type", "text/plain");
    expect(res.status).not.toBe(415);
  });
});
