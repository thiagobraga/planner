import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListRemindersForTask = vi.fn();
const mockCreateReminder = vi.fn();
const mockDeleteReminder = vi.fn();

vi.mock("../../services/reminderService.js", () => ({
  listRemindersForTask: (...args: unknown[]) => mockListRemindersForTask(...args),
  createReminder: (...args: unknown[]) => mockCreateReminder(...args),
  deleteReminder: (...args: unknown[]) => mockDeleteReminder(...args),
}));

import reminderRoutes, { taskReminderRouter } from "../reminders.js";

describe("reminders routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("standalone router (/api/v1/reminders)", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, res, next) => { req.userId = "test-user"; next(); });
    app.use("/api/v1/reminders", reminderRoutes);

    it("DELETE /api/v1/reminders/:id → calls deleteReminder", async () => {
      mockDeleteReminder.mockResolvedValue({ success: true });
      const res = await request(app).delete("/api/v1/reminders/r1");
      expect(res.status).toBe(200);
      expect(mockDeleteReminder).toHaveBeenCalledWith("r1", "test-user");
    });
  });

  describe("task-nested router (/api/v1/tasks/:taskId/reminders)", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, res, next) => { req.userId = "test-user"; next(); });
    app.use("/api/v1/tasks/:taskId/reminders", taskReminderRouter);

    it("GET /api/v1/tasks/:taskId/reminders → calls listRemindersForTask", async () => {
      mockListRemindersForTask.mockResolvedValue([{ id: "r1", dueDate: "2026-07-20" }]);
      const res = await request(app).get("/api/v1/tasks/t1/reminders");
      expect(res.status).toBe(200);
      expect(mockListRemindersForTask).toHaveBeenCalledWith("t1", "test-user");
    });

    it("POST /api/v1/tasks/:taskId/reminders → calls createReminder, returns 201", async () => {
      mockCreateReminder.mockResolvedValue({ id: "r1", dueDate: "2026-07-20" });
      const res = await request(app).post("/api/v1/tasks/t1/reminders").send({ remindAt: "2026-07-20" });
      expect(res.status).toBe(201);
      expect(mockCreateReminder).toHaveBeenCalledWith("t1", "test-user", "2026-07-20");
    });
  });
});
