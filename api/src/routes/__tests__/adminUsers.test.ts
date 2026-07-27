import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListUsers = vi.fn();
const mockDisableUser = vi.fn();
const mockEnableUser = vi.fn();
const mockRevokeSessions = vi.fn();

vi.mock("../../services/adminUserService.js", () => ({
  listUsers: (...args: unknown[]) => mockListUsers(...args),
  disableUser: (...args: unknown[]) => mockDisableUser(...args),
  enableUser: (...args: unknown[]) => mockEnableUser(...args),
  revokeSessions: (...args: unknown[]) => mockRevokeSessions(...args),
}));

import adminUserRoutes from "../adminUsers.js";

const app = createApp(adminUserRoutes, "/api/v1/admin/users");

const sampleUser = {
  id: "u2",
  email: "user@example.com",
  displayName: null,
  role: "user",
  createdAt: "2026-01-01T00:00:00.000Z",
  disabledAt: null,
  lastSeenAt: null,
  activeSessions: 0,
};

describe("admin user routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/admin/users → calls listUsers with no filters", async () => {
    mockListUsers.mockResolvedValue({ users: [sampleUser], nextCursor: null });

    const res = await request(app).get("/api/v1/admin/users");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [sampleUser], nextCursor: null });
    expect(mockListUsers).toHaveBeenCalledWith({
      search: undefined,
      cursor: undefined,
      limit: undefined,
    });
  });

  it("GET /api/v1/admin/users → forwards search, cursor and limit", async () => {
    mockListUsers.mockResolvedValue({ users: [], nextCursor: null });

    const res = await request(app).get("/api/v1/admin/users?search=ana&cursor=abc&limit=5");

    expect(res.status).toBe(200);
    expect(mockListUsers).toHaveBeenCalledWith({ search: "ana", cursor: "abc", limit: 5 });
  });

  it("GET /api/v1/admin/users → drops a non-numeric limit rather than passing NaN", async () => {
    mockListUsers.mockResolvedValue({ users: [], nextCursor: null });

    await request(app).get("/api/v1/admin/users?limit=lots");

    expect(mockListUsers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: undefined }),
    );
  });

  it("POST /api/v1/admin/users/:id/disable → calls disableUser with the acting admin", async () => {
    mockDisableUser.mockResolvedValue({ ...sampleUser, disabledAt: "2026-03-01T00:00:00.000Z" });

    const res = await request(app).post("/api/v1/admin/users/u2/disable");

    expect(res.status).toBe(200);
    expect(res.body.disabledAt).toBe("2026-03-01T00:00:00.000Z");
    expect(mockDisableUser).toHaveBeenCalledWith("test-user", "u2");
  });

  it("POST /api/v1/admin/users/:id/enable → calls enableUser", async () => {
    mockEnableUser.mockResolvedValue(sampleUser);

    const res = await request(app).post("/api/v1/admin/users/u2/enable");

    expect(res.status).toBe(200);
    expect(mockEnableUser).toHaveBeenCalledWith("test-user", "u2");
  });

  it("POST /api/v1/admin/users/:id/revoke-sessions → calls revokeSessions", async () => {
    mockRevokeSessions.mockResolvedValue(sampleUser);

    const res = await request(app).post("/api/v1/admin/users/u2/revoke-sessions");

    expect(res.status).toBe(200);
    expect(mockRevokeSessions).toHaveBeenCalledWith("test-user", "u2");
  });

  it("forwards service failures to the error handler", async () => {
    mockDisableUser.mockRejectedValue(new Error("boom"));

    const res = await request(app).post("/api/v1/admin/users/u2/disable");

    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
