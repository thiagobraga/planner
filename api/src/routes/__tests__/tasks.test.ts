import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockCompleteTask = vi.fn();
const mockReopenTask = vi.fn();
const mockReorderTask = vi.fn();
const mockMoveTask = vi.fn();
const mockDeleteTask = vi.fn();

vi.mock("../../services/taskService.js", () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  completeTask: (...args: unknown[]) => mockCompleteTask(...args),
  reopenTask: (...args: unknown[]) => mockReopenTask(...args),
  reorderTask: (...args: unknown[]) => mockReorderTask(...args),
  moveTask: (...args: unknown[]) => mockMoveTask(...args),
  deleteTask: (...args: unknown[]) => mockDeleteTask(...args),
}));

import taskRoutes from "../tasks.js";

const app = createApp(taskRoutes, "/api/v1/tasks");

describe("tasks routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/v1/tasks → calls createTask, returns 201", async () => {
    mockCreateTask.mockResolvedValue({ id: "t1", title: "Test" });
    const res = await request(app).post("/api/v1/tasks").send({ title: "Test", collectionId: "c1" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "t1", title: "Test" });
    expect(mockCreateTask).toHaveBeenCalledWith("test-user", { title: "Test", collectionId: "c1" });
  });

  it("PATCH /api/v1/tasks/:id → calls updateTask", async () => {
    mockUpdateTask.mockResolvedValue({ id: "t1", title: "Updated" });
    const res = await request(app).patch("/api/v1/tasks/t1").send({ title: "Updated" });
    expect(res.status).toBe(200);
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", "test-user", { title: "Updated" });
  });

  it("POST /api/v1/tasks/:id/complete → calls completeTask", async () => {
    mockCompleteTask.mockResolvedValue({ id: "t1", isCompleted: true });
    const res = await request(app).post("/api/v1/tasks/t1/complete");
    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith("t1", "test-user");
  });

  it("POST /api/v1/tasks/:id/reopen → calls reopenTask", async () => {
    mockReopenTask.mockResolvedValue({ id: "t1", isCompleted: false });
    const res = await request(app).post("/api/v1/tasks/t1/reopen");
    expect(res.status).toBe(200);
    expect(mockReopenTask).toHaveBeenCalledWith("t1", "test-user");
  });

  it("PATCH /api/v1/tasks/:id/reorder → calls reorderTask", async () => {
    mockReorderTask.mockResolvedValue({ id: "t1", orderValue: 1000 });
    const res = await request(app).patch("/api/v1/tasks/t1/reorder").send({ position: 1000 });
    expect(res.status).toBe(200);
    expect(mockReorderTask).toHaveBeenCalledWith("t1", "test-user", 1000);
  });

  it("PATCH /api/v1/tasks/:id/move → calls moveTask", async () => {
    mockMoveTask.mockResolvedValue({ id: "t1", collectionId: "c2" });
    const res = await request(app).patch("/api/v1/tasks/t1/move").send({ collectionId: "c2" });
    expect(res.status).toBe(200);
    expect(mockMoveTask).toHaveBeenCalledWith("t1", "test-user", { collectionId: "c2" });
  });

  it("DELETE /api/v1/tasks/:id → calls deleteTask", async () => {
    mockDeleteTask.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/tasks/t1");
    expect(res.status).toBe(200);
    expect(mockDeleteTask).toHaveBeenCalledWith("t1", "test-user");
  });
});
