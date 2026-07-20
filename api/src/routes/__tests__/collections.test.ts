import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListCollections = vi.fn();
const mockCreateCollection = vi.fn();
const mockUpdateCollection = vi.fn();
const mockDeleteCollection = vi.fn();
const mockArchiveCollection = vi.fn();

vi.mock("../../services/collectionService.js", () => ({
  listCollections: (...args: unknown[]) => mockListCollections(...args),
  createCollection: (...args: unknown[]) => mockCreateCollection(...args),
  updateCollection: (...args: unknown[]) => mockUpdateCollection(...args),
  deleteCollection: (...args: unknown[]) => mockDeleteCollection(...args),
  archiveCollection: (...args: unknown[]) => mockArchiveCollection(...args),
}));

import collectionRoutes from "../collections.js";

const app = createApp(collectionRoutes, "/api/v1/collections");

describe("collections routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/collections → calls listCollections", async () => {
    mockListCollections.mockResolvedValue([{ id: "c1", name: "Work" }]);
    const res = await request(app).get("/api/v1/collections");
    expect(res.status).toBe(200);
    expect(mockListCollections).toHaveBeenCalledWith("test-user");
  });

  it("POST /api/v1/collections → calls createCollection, returns 201", async () => {
    mockCreateCollection.mockResolvedValue({ id: "c1", name: "Work", color: "blue" });
    const res = await request(app).post("/api/v1/collections").send({ name: "Work", color: "blue" });
    expect(res.status).toBe(201);
    expect(mockCreateCollection).toHaveBeenCalledWith("test-user", { name: "Work", color: "blue" });
  });

  it("PATCH /api/v1/collections/:id → calls updateCollection", async () => {
    mockUpdateCollection.mockResolvedValue({ id: "c1", name: "Renamed" });
    const res = await request(app).patch("/api/v1/collections/c1").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateCollection).toHaveBeenCalledWith("c1", "test-user", { name: "Renamed" });
  });

  it("DELETE /api/v1/collections/:id → calls deleteCollection", async () => {
    mockDeleteCollection.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/collections/c1");
    expect(res.status).toBe(200);
    expect(mockDeleteCollection).toHaveBeenCalledWith("c1", "test-user");
  });

  it("POST /api/v1/collections/:id/archive → calls archiveCollection", async () => {
    mockArchiveCollection.mockResolvedValue({ id: "c1", isArchived: true });
    const res = await request(app).post("/api/v1/collections/c1/archive");
    expect(res.status).toBe(200);
    expect(mockArchiveCollection).toHaveBeenCalledWith("c1", "test-user");
  });
});
