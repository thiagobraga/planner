import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

vi.mock("../../services/labelService.js", () => ({
  listLabels: vi.fn().mockResolvedValue([]),
}));

const mockRoleQuery = vi.hoisted(() => vi.fn());

vi.mock("../../db/pool.js", () => ({
  default: { query: (...args: unknown[]) => mockRoleQuery(...args) },
}));

const mockListUsers = vi.hoisted(() => vi.fn());

vi.mock("../../services/adminUserService.js", () => ({
  listUsers: (...args: unknown[]) => mockListUsers(...args),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  revokeSessions: vi.fn(),
}));

import mainRouter from "../index.js";
import { errorHandler } from "../../middleware/errorHandler.js";

describe("main router (/api/v1)", () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1", mainRouter);

  // /health moved to index.ts, ahead of authMiddleware, so a container
  // healthcheck can reach it. It is covered by src/__tests__/index.test.ts.

  it("sub-routers are mounted (e.g., labels)", async () => {
    const res = await request(app).get("/api/v1/labels");
    expect(res.status).toBe(200);
  });
});

describe("admin routes (/api/v1/admin)", () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1", mainRouter);
  app.use(errorHandler);

  beforeEach(() => {
    mockRoleQuery.mockReset();
    mockListUsers.mockReset();
    mockListUsers.mockResolvedValue({ users: [], nextCursor: null });
  });

  it("serves /admin/users to an admin", async () => {
    mockRoleQuery.mockResolvedValue({ rows: [{ role: "admin", disabled_at: null }] });

    const res = await request(app).get("/api/v1/admin/users");

    expect(res.status).toBe(200);
    expect(mockListUsers).toHaveBeenCalled();
  });

  it("403s /admin/users for a non-admin without reaching the service", async () => {
    mockRoleQuery.mockResolvedValue({ rows: [{ role: "user", disabled_at: null }] });

    const res = await request(app).get("/api/v1/admin/users");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("403s /admin/stats for a non-admin", async () => {
    mockRoleQuery.mockResolvedValue({ rows: [{ role: "user", disabled_at: null }] });

    const res = await request(app).get("/api/v1/admin/stats/counts");

    expect(res.status).toBe(403);
  });
});
