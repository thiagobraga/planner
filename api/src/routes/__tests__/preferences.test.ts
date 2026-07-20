import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockGetPreferences = vi.fn();
const mockUpdatePreferences = vi.fn();

vi.mock("../../services/preferencesService.js", () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

import preferencesRoutes from "../preferences.js";

const app = createApp(preferencesRoutes, "/api/v1/preferences");

describe("preferences routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/preferences → calls getPreferences", async () => {
    mockGetPreferences.mockResolvedValue({ font: "lora" });
    const res = await request(app).get("/api/v1/preferences");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ font: "lora" });
    expect(mockGetPreferences).toHaveBeenCalledWith("test-user");
  });

  it("PATCH /api/v1/preferences → calls updatePreferences", async () => {
    mockUpdatePreferences.mockResolvedValue({ font: "playpen" });
    const res = await request(app).patch("/api/v1/preferences").send({ font: "playpen" });
    expect(res.status).toBe(200);
    expect(mockUpdatePreferences).toHaveBeenCalledWith("test-user", { font: "playpen" });
  });
});
