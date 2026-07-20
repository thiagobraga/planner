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

import mainRouter from "../index.js";

describe("main router (/api/v1)", () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1", mainRouter);

  it("GET /api/v1/health returns { status: 'ok' }", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("sub-routers are mounted (e.g., labels)", async () => {
    const res = await request(app).get("/api/v1/labels");
    expect(res.status).toBe(200);
  });
});
