import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListHabits = vi.fn();
const mockCreateHabit = vi.fn();
const mockUpdateHabit = vi.fn();
const mockDeleteHabit = vi.fn();
const mockToggleCompletion = vi.fn();
const mockMoveHabit = vi.fn();

vi.mock("../../services/habitService.js", () => ({
  listHabits: (...args: unknown[]) => mockListHabits(...args),
  createHabit: (...args: unknown[]) => mockCreateHabit(...args),
  updateHabit: (...args: unknown[]) => mockUpdateHabit(...args),
  deleteHabit: (...args: unknown[]) => mockDeleteHabit(...args),
  toggleCompletion: (...args: unknown[]) => mockToggleCompletion(...args),
  moveHabit: (...args: unknown[]) => mockMoveHabit(...args),
}));

import habitRoutes from "../habits.js";

const app = createApp(habitRoutes, "/api/v1/habits");

describe("habits routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/habits → calls listHabits", async () => {
    mockListHabits.mockResolvedValue([{ id: "h1", name: "Exercise" }]);
    const res = await request(app).get("/api/v1/habits");
    expect(res.status).toBe(200);
    expect(mockListHabits).toHaveBeenCalledWith("test-user");
  });

  it("POST /api/v1/habits → calls createHabit, returns 201", async () => {
    mockCreateHabit.mockResolvedValue({ id: "h1", name: "Exercise" });
    const res = await request(app).post("/api/v1/habits").send({ name: "Exercise" });
    expect(res.status).toBe(201);
    expect(mockCreateHabit).toHaveBeenCalledWith("test-user", { name: "Exercise", parentId: undefined, groupId: undefined });
  });

  it("PATCH /api/v1/habits/:id → calls updateHabit", async () => {
    mockUpdateHabit.mockResolvedValue({ id: "h1", name: "Renamed" });
    const res = await request(app).patch("/api/v1/habits/h1").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateHabit).toHaveBeenCalledWith("test-user", "h1", { name: "Renamed" });
  });

  it("DELETE /api/v1/habits/:id → calls deleteHabit, returns 204", async () => {
    mockDeleteHabit.mockResolvedValue(undefined);
    const res = await request(app).delete("/api/v1/habits/h1");
    expect(res.status).toBe(204);
    expect(mockDeleteHabit).toHaveBeenCalledWith("test-user", "h1");
  });

  it("PUT /api/v1/habits/:id/completions → calls toggleCompletion", async () => {
    mockToggleCompletion.mockResolvedValue({ habitId: "h1", date: "2026-07-19", isCompleted: true });
    const res = await request(app).put("/api/v1/habits/h1/completions").send({ date: "2026-07-19", isCompleted: true });
    expect(res.status).toBe(200);
    expect(mockToggleCompletion).toHaveBeenCalledWith("test-user", "h1", "2026-07-19", true);
  });

  it("PATCH /api/v1/habits/:id/move → calls moveHabit", async () => {
    mockMoveHabit.mockResolvedValue({ id: "h1", groupId: "g1" });
    const res = await request(app).patch("/api/v1/habits/h1/move").send({ groupId: "g1" });
    expect(res.status).toBe(200);
    expect(mockMoveHabit).toHaveBeenCalledWith("test-user", "h1", { groupId: "g1" });
  });
});
