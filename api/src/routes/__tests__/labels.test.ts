import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListLabels = vi.fn();
const mockCreateLabel = vi.fn();
const mockUpdateLabel = vi.fn();
const mockDeleteLabel = vi.fn();

vi.mock("../../services/labelService.js", () => ({
  listLabels: (...args: unknown[]) => mockListLabels(...args),
  createLabel: (...args: unknown[]) => mockCreateLabel(...args),
  updateLabel: (...args: unknown[]) => mockUpdateLabel(...args),
  deleteLabel: (...args: unknown[]) => mockDeleteLabel(...args),
}));

import labelRoutes from "../labels.js";

const app = createApp(labelRoutes, "/api/v1/labels");

describe("labels routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/labels → calls listLabels", async () => {
    mockListLabels.mockResolvedValue([{ id: "l1", name: "urgent" }]);
    const res = await request(app).get("/api/v1/labels");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "l1", name: "urgent" }]);
    expect(mockListLabels).toHaveBeenCalledWith("test-user");
  });

  it("POST /api/v1/labels → calls createLabel, returns 201", async () => {
    mockCreateLabel.mockResolvedValue({ id: "l1", name: "urgent", color: "red" });
    const res = await request(app).post("/api/v1/labels").send({ name: "urgent", color: "red" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "l1", name: "urgent", color: "red" });
    expect(mockCreateLabel).toHaveBeenCalledWith("test-user", { name: "urgent", color: "red" });
  });

  it("PATCH /api/v1/labels/:id → calls updateLabel", async () => {
    mockUpdateLabel.mockResolvedValue({ id: "l1", name: "renamed" });
    const res = await request(app).patch("/api/v1/labels/l1").send({ name: "renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateLabel).toHaveBeenCalledWith("l1", "test-user", { name: "renamed" });
  });

  it("DELETE /api/v1/labels/:id → calls deleteLabel", async () => {
    mockDeleteLabel.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/labels/l1");
    expect(res.status).toBe(200);
    expect(mockDeleteLabel).toHaveBeenCalledWith("l1", "test-user");
  });
});
