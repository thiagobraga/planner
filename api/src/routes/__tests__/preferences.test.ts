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

const mockGetPreferences = vi.fn();
const mockUpdatePreferences = vi.fn();

vi.mock("../../services/preferencesService.js", () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

import preferencesRoutes from "../preferences.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => { req.userId = "test-user"; next(); });
app.use("/api/v1/preferences", preferencesRoutes);
app.use(errorHandler);

describe("preferences routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/preferences → calls getPreferences", async () => {
    mockGetPreferences.mockResolvedValue({
      font: "lora",
      hideCompletedTasks: false,
      hideOldNotes: false,
      collapsedCollectionIds: [],
    });
    const res = await request(app).get("/api/v1/preferences");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      font: "lora",
      hideCompletedTasks: false,
      hideOldNotes: false,
      collapsedCollectionIds: [],
    });
    expect(mockGetPreferences).toHaveBeenCalledWith("test-user");
  });

  it("PATCH /api/v1/preferences → calls updatePreferences", async () => {
    const collectionId = "11111111-1111-4111-8111-111111111111";
    mockUpdatePreferences.mockResolvedValue({
      font: "playpen",
      hideCompletedTasks: true,
      hideOldNotes: true,
      collapsedCollectionIds: [collectionId],
    });
    const res = await request(app).patch("/api/v1/preferences").send({
      font: "playpen",
      hideCompletedTasks: true,
      collapsedCollectionIds: [collectionId],
    });
    expect(res.status).toBe(200);
    expect(res.body.collapsedCollectionIds).toEqual([collectionId]);
    expect(mockUpdatePreferences).toHaveBeenCalledWith("test-user", {
      font: "playpen",
      hideCompletedTasks: true,
      collapsedCollectionIds: [collectionId],
    });
  });

  it("surfaces getPreferences errors through the error handler", async () => {
    mockGetPreferences.mockRejectedValue(new Error("database unavailable"));
    const res = await request(app).get("/api/v1/preferences");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("surfaces updatePreferences errors through the error handler", async () => {
    mockUpdatePreferences.mockRejectedValue(new Error("database unavailable"));
    const res = await request(app).patch("/api/v1/preferences").send({ font: "lora" });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
