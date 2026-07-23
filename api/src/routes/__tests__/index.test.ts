import { describe, it, expect, vi } from "vitest";
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

  // /health moved to index.ts, ahead of authMiddleware, so a container
  // healthcheck can reach it. It is covered by src/__tests__/index.test.ts.

  it("sub-routers are mounted (e.g., labels)", async () => {
    const res = await request(app).get("/api/v1/labels");
    expect(res.status).toBe(200);
  });
});
