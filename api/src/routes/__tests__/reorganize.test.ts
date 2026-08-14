import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockReorganizeTasks = vi.fn();

vi.mock("../../services/taskService.js", () => ({
  reorganizeTasks: (...args: unknown[]) => mockReorganizeTasks(...args),
}));

import taskRoutes from "../tasks.js";

const app = createApp(taskRoutes, "/api/v1/tasks");

describe("POST /api/v1/tasks/reorganize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST route calls reorganizeTasks with user ID and moves", async () => {
    mockReorganizeTasks.mockResolvedValue({ updated: 5 });

    const moves = [
      { taskId: "t1", dueDate: "2026-08-14" },
      { taskId: "t2", dueDate: "2026-08-14" },
      { taskId: "t3", dueDate: "2026-08-14" },
      { taskId: "t4", dueDate: "2026-08-14" },
      { taskId: "t5", dueDate: "2026-08-14" },
    ];

    const res = await request(app).post("/api/v1/tasks/reorganize").send({ moves });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(5);
    expect(mockReorganizeTasks).toHaveBeenCalledWith("test-user", moves);
  });

  it("returns updated count from service", async () => {
    mockReorganizeTasks.mockResolvedValue({ updated: 7 });

    const moves = [
      { taskId: "t1", dueDate: "2026-08-14" },
      { taskId: "t2", dueDate: "2026-08-15" },
    ];

    const res = await request(app).post("/api/v1/tasks/reorganize").send({ moves });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(7);
  });

  it("propagates errors from service", async () => {
    const error = new Error("Task validation failed");
    mockReorganizeTasks.mockRejectedValue(error);

    const moves = [{ taskId: "invalid", dueDate: "2026-08-14" }];

    const res = await request(app).post("/api/v1/tasks/reorganize").send({ moves });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("returns 200 with updated=0 when no dates changed", async () => {
    mockReorganizeTasks.mockResolvedValue({ updated: 0 });

    const moves = [{ taskId: "t1", dueDate: "2026-08-13" }];

    const res = await request(app).post("/api/v1/tasks/reorganize").send({ moves });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(0);
  });

  it("handles batch of 100 moves", async () => {
    mockReorganizeTasks.mockResolvedValue({ updated: 100 });

    const moves = Array.from({ length: 100 }, (_, i) => ({
      taskId: `t${i}`,
      dueDate: "2026-08-14",
    }));

    const res = await request(app).post("/api/v1/tasks/reorganize").send({ moves });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(100);
  });
});
