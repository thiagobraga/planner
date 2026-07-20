import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListActivity = vi.fn();

vi.mock("../../services/activityService.js", () => ({
  listActivity: (...args: unknown[]) => mockListActivity(...args),
}));

import activityRoutes from "../activity.js";

const app = createApp(activityRoutes, "/api/v1/activity");

describe("activity routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/activity → calls listActivity", async () => {
    mockListActivity.mockResolvedValue({ events: [], nextCursor: null });
    const res = await request(app).get("/api/v1/activity");
    expect(res.status).toBe(200);
    expect(mockListActivity).toHaveBeenCalledWith("test-user", {});
  });

  it("GET /api/v1/activity?collection_id=c1&cursor=abc → passes params", async () => {
    mockListActivity.mockResolvedValue({ events: [], nextCursor: null });
    const res = await request(app).get("/api/v1/activity?collection_id=c1&cursor=abc");
    expect(res.status).toBe(200);
    expect(mockListActivity).toHaveBeenCalledWith("test-user", { collectionId: "c1", cursor: "abc" });
  });
});
