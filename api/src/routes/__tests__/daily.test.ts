import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { AppError } from "../../utils/AppError.js";

const mockGetDailyView = vi.fn();

vi.mock("../../services/dailyService.js", () => ({
  getDailyView: (...args: unknown[]) => mockGetDailyView(...args),
}));

import dailyRoutes from "../daily.js";

const app = createApp(dailyRoutes, "/api/v1/daily");
app.use(errorHandler);

describe("daily routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/daily/:from/:to calls getDailyView with the caller and the range", async () => {
    const view = { from: "2026-10-05", to: "2026-10-11", today: "2026-10-07", overdue: [], days: [] };
    mockGetDailyView.mockResolvedValue(view);

    const res = await request(app).get("/api/v1/daily/2026-10-05/2026-10-11");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(view);
    expect(mockGetDailyView).toHaveBeenCalledWith("test-user", "2026-10-05", "2026-10-11");
  });

  it.each([
    ["/api/v1/daily/2026-10-05/abc"],
    ["/api/v1/daily/abc/2026-10-05"],
    ["/api/v1/daily/2026-10-5/2026-10-11"],
    ["/api/v1/daily/2026-10-05"],
    ["/api/v1/daily/2026-10-05/2026-10-11/extra"],
  ])("answers 404 without reaching the service for %s", async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(404);
    expect(mockGetDailyView).not.toHaveBeenCalled();
  });

  it("maps a service validation failure to 400 VALIDATION_ERROR with details", async () => {
    mockGetDailyView.mockRejectedValue(
      new AppError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        statusCode: 400,
        details: [{ field: "to", message: "range must not exceed 42 days" }],
      }),
    );

    const res = await request(app).get("/api/v1/daily/2026-10-01/2026-12-01");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([{ field: "to", message: "range must not exceed 42 days" }]);
  });

  it("only answers GET", async () => {
    const res = await request(app).post("/api/v1/daily/2026-10-05/2026-10-11");

    expect(res.status).toBe(404);
    expect(mockGetDailyView).not.toHaveBeenCalled();
  });
});
