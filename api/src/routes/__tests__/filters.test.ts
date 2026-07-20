import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListFilters = vi.fn();
const mockCreateFilter = vi.fn();
const mockUpdateFilter = vi.fn();
const mockDeleteFilter = vi.fn();
const mockEvaluateSavedFilter = vi.fn();

vi.mock("../../services/filterService.js", () => ({
  listFilters: (...args: unknown[]) => mockListFilters(...args),
  createFilter: (...args: unknown[]) => mockCreateFilter(...args),
  updateFilter: (...args: unknown[]) => mockUpdateFilter(...args),
  deleteFilter: (...args: unknown[]) => mockDeleteFilter(...args),
  evaluateSavedFilter: (...args: unknown[]) => mockEvaluateSavedFilter(...args),
}));

import filterRoutes from "../filters.js";

const app = createApp(filterRoutes, "/api/v1/filters");

describe("filters routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/filters → calls listFilters", async () => {
    mockListFilters.mockResolvedValue([{ id: "f1", name: "High priority" }]);
    const res = await request(app).get("/api/v1/filters");
    expect(res.status).toBe(200);
    expect(mockListFilters).toHaveBeenCalledWith("test-user");
  });

  it("POST /api/v1/filters → calls createFilter, returns 201", async () => {
    mockCreateFilter.mockResolvedValue({ id: "f1", name: "High", query: "priority:1" });
    const res = await request(app).post("/api/v1/filters").send({ name: "High", query: "priority:1" });
    expect(res.status).toBe(201);
    expect(mockCreateFilter).toHaveBeenCalledWith("test-user", { name: "High", query: "priority:1" });
  });

  it("PATCH /api/v1/filters/:id → calls updateFilter", async () => {
    mockUpdateFilter.mockResolvedValue({ id: "f1", name: "Renamed" });
    const res = await request(app).patch("/api/v1/filters/f1").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateFilter).toHaveBeenCalledWith("f1", "test-user", { name: "Renamed" });
  });

  it("DELETE /api/v1/filters/:id → calls deleteFilter", async () => {
    mockDeleteFilter.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/filters/f1");
    expect(res.status).toBe(200);
    expect(mockDeleteFilter).toHaveBeenCalledWith("f1", "test-user");
  });

  it("GET /api/v1/filters/:id/results → calls evaluateSavedFilter", async () => {
    mockEvaluateSavedFilter.mockResolvedValue([{ id: "t1", title: "Task" }]);
    const res = await request(app).get("/api/v1/filters/f1/results");
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(mockEvaluateSavedFilter).toHaveBeenCalledWith("f1", "test-user", expect.any(String));
  });
});
