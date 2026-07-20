import { describe, it, expect, vi } from "vitest";
import request from "supertest";

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
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.userId = "test-user";
    req.sessionId = 1;
    next();
  }),
}));

vi.mock("../middleware/csrf.js", () => ({
  csrfProtection: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock("../middleware/origin.js", () => ({
  originCheck: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock("../middleware/errorHandler.js", () => ({
  errorHandler: vi.fn((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }),
}));

vi.mock("../middleware/notFound.js", () => ({
  notFound: vi.fn((_req: any, res: any) => {
    res.status(404).json({ error: { code: "NOT_FOUND" } });
  }),
}));

vi.mock("../routes/auth.js", () => ({ default: vi.fn() }));

vi.mock("../routes/tasks.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next(new Error("Test error"))) }));
vi.mock("../routes/labels.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/collections.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/sections.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/views.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/filters.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/search.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/reminders.js", () => ({
  default: vi.fn((_req: any, _res: any, next: any) => next()),
  taskReminderRouter: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock("../routes/comments.js", () => ({
  default: vi.fn((_req: any, _res: any, next: any) => next()),
  taskCommentRouter: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock("../routes/preferences.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/habits.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/habitGroups.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/activity.js", () => ({ default: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../routes/collaboration.js", () => ({
  default: vi.fn((_req: any, _res: any, next: any) => next()),
  collectionCollabRouter: vi.fn((_req: any, _res: any, next: any) => next()),
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
