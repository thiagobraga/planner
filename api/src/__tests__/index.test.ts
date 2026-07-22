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

vi.mock("../routes/auth.js", () => ({ default: vi.fn() }));

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
});
