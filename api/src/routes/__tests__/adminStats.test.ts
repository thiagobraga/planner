import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockGetCounts = vi.fn();
const mockGetSystemHealth = vi.fn();
const mockGetAuthStats = vi.fn();

vi.mock("../../services/adminStatsService.js", () => ({
  getCounts: (...args: unknown[]) => mockGetCounts(...args),
  getSystemHealth: (...args: unknown[]) => mockGetSystemHealth(...args),
  getAuthStats: (...args: unknown[]) => mockGetAuthStats(...args),
}));

import adminStatsRoutes from "../adminStats.js";

const app = createApp(adminStatsRoutes, "/api/v1/admin/stats");

describe("admin stats routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/admin/stats/counts → returns the count payload", async () => {
    const counts = {
      users: 3,
      activeUsers: 2,
      disabledUsers: 1,
      admins: 1,
      tasks: 10,
      completedTasks: 4,
      collections: 5,
      habits: 2,
    };
    mockGetCounts.mockResolvedValue(counts);

    const res = await request(app).get("/api/v1/admin/stats/counts");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(counts);
  });

  it("GET /api/v1/admin/stats/health → returns the health payload", async () => {
    const health = {
      database: { status: "up", totalConnections: 2, idleConnections: 1, waitingRequests: 0 },
      redis: { status: "down" },
      process: { uptimeSeconds: 90, memoryRssBytes: 1024, nodeVersion: "v24.0.0" },
    };
    mockGetSystemHealth.mockResolvedValue(health);

    const res = await request(app).get("/api/v1/admin/stats/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(health);
  });

  it("GET /api/v1/admin/stats/auth → returns the auth payload", async () => {
    const stats = {
      activeSessions: 4,
      sessionsLastDay: 2,
      usersOnlineLastHour: 1,
      throttledAccounts: 0,
      throttledIps: 0,
      failedLoginAttempts: 0,
    };
    mockGetAuthStats.mockResolvedValue(stats);

    const res = await request(app).get("/api/v1/admin/stats/auth");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(stats);
  });

  it("forwards service failures to the error handler", async () => {
    mockGetCounts.mockRejectedValue(new Error("boom"));

    const res = await request(app).get("/api/v1/admin/stats/counts");

    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
