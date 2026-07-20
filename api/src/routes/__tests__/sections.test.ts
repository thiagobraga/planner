import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListSections = vi.fn();
const mockCreateSection = vi.fn();
const mockUpdateSection = vi.fn();
const mockDeleteSection = vi.fn();

vi.mock("../../services/sectionService.js", () => ({
  listSections: (...args: unknown[]) => mockListSections(...args),
  createSection: (...args: unknown[]) => mockCreateSection(...args),
  updateSection: (...args: unknown[]) => mockUpdateSection(...args),
  deleteSection: (...args: unknown[]) => mockDeleteSection(...args),
}));

import sectionRoutes from "../sections.js";

const app = createApp(sectionRoutes, "/api/v1");

describe("sections routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/collections/:id/sections → calls listSections", async () => {
    mockListSections.mockResolvedValue([{ id: "s1", name: "Todo" }]);
    const res = await request(app).get("/api/v1/collections/c1/sections");
    expect(res.status).toBe(200);
    expect(mockListSections).toHaveBeenCalledWith("c1", "test-user");
  });

  it("POST /api/v1/collections/:id/sections → calls createSection, returns 201", async () => {
    mockCreateSection.mockResolvedValue({ id: "s1", name: "New Section" });
    const res = await request(app).post("/api/v1/collections/c1/sections").send({ name: "New Section" });
    expect(res.status).toBe(201);
    expect(mockCreateSection).toHaveBeenCalledWith("c1", "test-user", { name: "New Section" });
  });

  it("PATCH /api/v1/sections/:id → calls updateSection", async () => {
    mockUpdateSection.mockResolvedValue({ id: "s1", name: "Renamed" });
    const res = await request(app).patch("/api/v1/sections/s1").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateSection).toHaveBeenCalledWith("s1", "test-user", { name: "Renamed" });
  });

  it("DELETE /api/v1/sections/:id → calls deleteSection", async () => {
    mockDeleteSection.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/sections/s1");
    expect(res.status).toBe(200);
    expect(mockDeleteSection).toHaveBeenCalledWith("s1", "test-user");
  });
});
