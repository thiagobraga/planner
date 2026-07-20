import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListGroups = vi.fn();
const mockCreateGroup = vi.fn();
const mockUpdateGroup = vi.fn();
const mockDeleteGroup = vi.fn();
const mockMoveHabitGroup = vi.fn();

vi.mock("../../services/habitService.js", () => ({
  listGroups: (...args: unknown[]) => mockListGroups(...args),
  createGroup: (...args: unknown[]) => mockCreateGroup(...args),
  updateGroup: (...args: unknown[]) => mockUpdateGroup(...args),
  deleteGroup: (...args: unknown[]) => mockDeleteGroup(...args),
  moveHabitGroup: (...args: unknown[]) => mockMoveHabitGroup(...args),
}));

import habitGroupRoutes from "../habitGroups.js";

const app = createApp(habitGroupRoutes, "/api/v1/habit-groups");

describe("habit groups routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/habit-groups → calls listGroups", async () => {
    mockListGroups.mockResolvedValue([{ id: "g1", name: "Morning" }]);
    const res = await request(app).get("/api/v1/habit-groups");
    expect(res.status).toBe(200);
    expect(mockListGroups).toHaveBeenCalledWith("test-user");
  });

  it("POST /api/v1/habit-groups → calls createGroup, returns 201", async () => {
    mockCreateGroup.mockResolvedValue({ id: "g1", name: "Morning" });
    const res = await request(app).post("/api/v1/habit-groups").send({ name: "Morning" });
    expect(res.status).toBe(201);
    expect(mockCreateGroup).toHaveBeenCalledWith("test-user", "Morning");
  });

  it("PATCH /api/v1/habit-groups/:id → calls updateGroup", async () => {
    mockUpdateGroup.mockResolvedValue({ id: "g1", name: "Renamed" });
    const res = await request(app).patch("/api/v1/habit-groups/g1").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateGroup).toHaveBeenCalledWith("test-user", "g1", { name: "Renamed" });
  });

  it("DELETE /api/v1/habit-groups/:id → calls deleteGroup, returns 204", async () => {
    mockDeleteGroup.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/v1/habit-groups/g1");
    expect(res.status).toBe(204);
    expect(mockDeleteGroup).toHaveBeenCalledWith("test-user", "g1");
  });

  it("PATCH /api/v1/habit-groups/:id/move → calls moveHabitGroup", async () => {
    mockMoveHabitGroup.mockResolvedValue({ id: "g1", orderValue: 1000 });
    const res = await request(app).patch("/api/v1/habit-groups/g1/move").send({ position: 0 });
    expect(res.status).toBe(200);
    expect(mockMoveHabitGroup).toHaveBeenCalledWith("test-user", "g1", { position: 0 });
  });
});
