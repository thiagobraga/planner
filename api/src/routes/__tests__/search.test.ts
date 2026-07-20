import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockSearchEntities = vi.fn();

vi.mock("../../services/searchService.js", () => ({
  searchEntities: (...args: unknown[]) => mockSearchEntities(...args),
}));

import searchRoutes from "../search.js";

const app = createApp(searchRoutes, "/api/v1/search");

describe("search routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/search?q=test → calls searchEntities", async () => {
    mockSearchEntities.mockResolvedValue({ tasks: [{ id: "t1" }] });
    const res = await request(app).get("/api/v1/search?q=test");
    expect(res.status).toBe(200);
    expect(mockSearchEntities).toHaveBeenCalledWith("test-user", "test");
  });

  it("GET /api/v1/search without q → still calls with empty string", async () => {
    mockSearchEntities.mockResolvedValue({ tasks: [] });
    const res = await request(app).get("/api/v1/search");
    expect(res.status).toBe(200);
    expect(mockSearchEntities).toHaveBeenCalledWith("test-user", "");
  });
});
