import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../../middleware/errorHandler.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockInviteToCollection = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockListCollaborators = vi.fn();
const mockRemoveCollaborator = vi.fn();
const mockAssignTask = vi.fn();

vi.mock("../../services/collaborationService.js", () => ({
  inviteToCollection: (...args: unknown[]) => mockInviteToCollection(...args),
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
  listCollaborators: (...args: unknown[]) => mockListCollaborators(...args),
  removeCollaborator: (...args: unknown[]) => mockRemoveCollaborator(...args),
  assignTask: (...args: unknown[]) => mockAssignTask(...args),
}));

import collaborationRoutes, { collectionCollabRouter } from "../collaboration.js";

describe("collaboration routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("collection-scoped router (/api/v1/collections/:id)", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, res, next) => { req.userId = "test-user"; next(); });
    app.use("/api/v1/collections/:id", collectionCollabRouter);
    app.use(errorHandler);

    it("POST /api/v1/collections/:id/invitations → calls inviteToCollection, returns 201", async () => {
      mockInviteToCollection.mockResolvedValue({ invitation: { id: "inv-1" }, token: "abc" });
      const res = await request(app).post("/api/v1/collections/c1/invitations").send({ email: "a@b.com" });
      expect(res.status).toBe(201);
      expect(res.body.token).toBe("abc");
      expect(mockInviteToCollection).toHaveBeenCalledWith("c1", "test-user", "a@b.com");
    });

    it("surfaces inviteToCollection errors through the error handler", async () => {
      mockInviteToCollection.mockRejectedValue(new Error("database unavailable"));
      const res = await request(app).post("/api/v1/collections/c1/invitations").send({ email: "a@b.com" });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });

    it("GET /api/v1/collections/:id/collaborators → calls listCollaborators", async () => {
      mockListCollaborators.mockResolvedValue([{ userId: "u2", email: "b@b.com" }]);
      const res = await request(app).get("/api/v1/collections/c1/collaborators");
      expect(res.status).toBe(200);
      expect(mockListCollaborators).toHaveBeenCalledWith("c1", "test-user");
    });

    it("surfaces listCollaborators errors through the error handler", async () => {
      mockListCollaborators.mockRejectedValue(new Error("database unavailable"));
      const res = await request(app).get("/api/v1/collections/c1/collaborators");
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });

    it("DELETE /api/v1/collections/:id/collaborators/:userId → calls removeCollaborator", async () => {
      mockRemoveCollaborator.mockResolvedValue({ success: true });
      const res = await request(app).delete("/api/v1/collections/c1/collaborators/u2");
      expect(res.status).toBe(200);
      expect(mockRemoveCollaborator).toHaveBeenCalledWith("c1", "u2", "test-user");
    });

    it("surfaces removeCollaborator errors through the error handler", async () => {
      mockRemoveCollaborator.mockRejectedValue(new Error("database unavailable"));
      const res = await request(app).delete("/api/v1/collections/c1/collaborators/u2");
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("standalone router", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use((req, res, next) => { req.userId = "test-user"; next(); });
    app.use("/api/v1", collaborationRoutes);
    app.use(errorHandler);

    it("POST /api/v1/invitations/accept → calls acceptInvitation", async () => {
      mockAcceptInvitation.mockResolvedValue({ success: true });
      const res = await request(app).post("/api/v1/invitations/accept").send({ token: "abc" });
      expect(res.status).toBe(200);
      expect(mockAcceptInvitation).toHaveBeenCalledWith("abc", "test-user");
    });

    it("surfaces acceptInvitation errors through the error handler", async () => {
      mockAcceptInvitation.mockRejectedValue(new Error("database unavailable"));
      const res = await request(app).post("/api/v1/invitations/accept").send({ token: "abc" });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });

    it("POST /api/v1/tasks/:id/assign → calls assignTask", async () => {
      mockAssignTask.mockResolvedValue({ success: true });
      const res = await request(app).post("/api/v1/tasks/t1/assign").send({ assigneeUserId: "u2" });
      expect(res.status).toBe(200);
      expect(mockAssignTask).toHaveBeenCalledWith("t1", "u2", "test-user");
    });

    it("surfaces assignTask errors through the error handler", async () => {
      mockAssignTask.mockRejectedValue(new Error("database unavailable"));
      const res = await request(app).post("/api/v1/tasks/t1/assign").send({ assigneeUserId: "u2" });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
