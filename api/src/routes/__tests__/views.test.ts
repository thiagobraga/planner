import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockGetTodayView = vi.fn();
const mockGetUpcomingView = vi.fn();
const mockGetInboxView = vi.fn();
const mockGetCollectionView = vi.fn();
const mockGetMonthView = vi.fn();

vi.mock("../../services/viewService.js", () => ({
  getTodayView: (...args: unknown[]) => mockGetTodayView(...args),
  getUpcomingView: (...args: unknown[]) => mockGetUpcomingView(...args),
  getInboxView: (...args: unknown[]) => mockGetInboxView(...args),
  getCollectionView: (...args: unknown[]) => mockGetCollectionView(...args),
  getMonthView: (...args: unknown[]) => mockGetMonthView(...args),
}));

import viewRoutes from "../views.js";

const app = createApp(viewRoutes, "/api/v1/views");

describe("views routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/views/today → calls getTodayView", async () => {
    mockGetTodayView.mockResolvedValue({ overdue: [], today: [] });
    const res = await request(app).get("/api/v1/views/today");
    expect(res.status).toBe(200);
    expect(mockGetTodayView).toHaveBeenCalledWith("test-user");
  });

  it("GET /api/v1/views/upcoming?days=7 → calls getUpcomingView with 7", async () => {
    mockGetUpcomingView.mockResolvedValue([]);
    const res = await request(app).get("/api/v1/views/upcoming?days=7");
    expect(res.status).toBe(200);
    expect(mockGetUpcomingView).toHaveBeenCalledWith("test-user", 7);
  });

  it("GET /api/v1/views/upcoming without days → defaults to 7", async () => {
    mockGetUpcomingView.mockResolvedValue([]);
    const res = await request(app).get("/api/v1/views/upcoming");
    expect(res.status).toBe(200);
    expect(mockGetUpcomingView).toHaveBeenCalledWith("test-user", 7);
  });

  it("GET /api/v1/views/inbox → calls getInboxView", async () => {
    mockGetInboxView.mockResolvedValue({ tasks: [] });
    const res = await request(app).get("/api/v1/views/inbox");
    expect(res.status).toBe(200);
    expect(mockGetInboxView).toHaveBeenCalledWith("test-user");
  });

  it("GET /api/v1/views/collection/:id → calls getCollectionView", async () => {
    mockGetCollectionView.mockResolvedValue({ tasks: [] });
    const res = await request(app).get("/api/v1/views/collection/c1");
    expect(res.status).toBe(200);
    expect(mockGetCollectionView).toHaveBeenCalledWith("test-user", "c1");
  });

  it("GET /api/v1/views/month?year=2026&month=7 → calls getMonthView", async () => {
    mockGetMonthView.mockResolvedValue({ weeks: [] });
    const res = await request(app).get("/api/v1/views/month?year=2026&month=7");
    expect(res.status).toBe(200);
    expect(mockGetMonthView).toHaveBeenCalledWith("test-user", 2026, 7);
  });
});
