import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

const mockGetDailyRange = vi.fn();
vi.mock("../../services/dailyService.js", () => ({
  getDailyRange: (...args: unknown[]) => mockGetDailyRange(...args),
}));

import dailyRoutes from "../daily.js";

const app = createApp(dailyRoutes, "/api/v1/daily");

describe("daily route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes a valid date range and returns the daily response", async () => {
    const view = { from: "2024-06-14", to: "2024-06-15", today: "2024-06-14", overdue: [], days: [] };
    mockGetDailyRange.mockResolvedValueOnce(view);
    const response = await request(app).get("/api/v1/daily/2024-06-14/2024-06-15");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(view);
    expect(mockGetDailyRange).toHaveBeenCalledWith("test-user", "2024-06-14", "2024-06-15");
  });

  it("does not route malformed date segments", async () => {
    const response = await request(app).get("/api/v1/daily/today/2024-06-15");
    expect(response.status).toBe(404);
    expect(mockGetDailyRange).not.toHaveBeenCalled();
  });
});
