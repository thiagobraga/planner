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

const mockListComments = vi.fn();
const mockCreateComment = vi.fn();
const mockUpdateComment = vi.fn();
const mockDeleteComment = vi.fn();

vi.mock("../../services/commentService.js", () => ({
  listComments: (...args: unknown[]) => mockListComments(...args),
  createComment: (...args: unknown[]) => mockCreateComment(...args),
  updateComment: (...args: unknown[]) => mockUpdateComment(...args),
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
}));

import commentRoutes, { taskCommentRouter } from "../comments.js";

describe("comments routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("standalone router (/api/v1/comments)", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, res, next) => { (req as any).userId = "test-user"; next(); });
    app.use("/api/v1/comments", commentRoutes);

    it("PATCH /api/v1/comments/:id → calls updateComment", async () => {
      mockUpdateComment.mockResolvedValue({ id: "c1", body: "Updated" });
      const res = await request(app).patch("/api/v1/comments/c1").send({ body: "Updated" });
      expect(res.status).toBe(200);
      expect(mockUpdateComment).toHaveBeenCalledWith("c1", "test-user", "Updated");
    });

    it("DELETE /api/v1/comments/:id → calls deleteComment", async () => {
      mockDeleteComment.mockResolvedValue({ success: true });
      const res = await request(app).delete("/api/v1/comments/c1");
      expect(res.status).toBe(200);
      expect(mockDeleteComment).toHaveBeenCalledWith("c1", "test-user");
    });
  });

  describe("task-nested router (/api/v1/tasks/:taskId/comments)", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, res, next) => { (req as any).userId = "test-user"; next(); });
    app.use("/api/v1/tasks/:taskId/comments", taskCommentRouter);

    it("GET /api/v1/tasks/:taskId/comments → calls listComments", async () => {
      mockListComments.mockResolvedValue([{ id: "c1", body: "Nice" }]);
      const res = await request(app).get("/api/v1/tasks/t1/comments");
      expect(res.status).toBe(200);
      expect(mockListComments).toHaveBeenCalledWith("t1", "test-user");
    });

    it("POST /api/v1/tasks/:taskId/comments → calls createComment, returns 201", async () => {
      mockCreateComment.mockResolvedValue({ id: "c1", body: "Nice" });
      const res = await request(app).post("/api/v1/tasks/t1/comments").send({ body: "Nice" });
      expect(res.status).toBe(201);
      expect(mockCreateComment).toHaveBeenCalledWith("t1", "test-user", "Nice");
    });
  });
});
