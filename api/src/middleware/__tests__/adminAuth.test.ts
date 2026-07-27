import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { adminAuthMiddleware } from "../adminAuth.js";

describe("adminAuthMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  // See middleware/__tests__/auth.test.ts: NextFunction is overloaded, so the
  // mock type is intersected rather than parameterised.
  let next: NextFunction & Mock<(err?: unknown) => void>;

  function forbiddenError(): AppError {
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }

  beforeEach(() => {
    mockQuery.mockReset();
    next = vi.fn() as NextFunction & Mock<(err?: unknown) => void>;
    req = { userId: "u1" };
    res = {};
  });

  it("calls next with no error for an admin", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: "admin", disabled_at: null }] });

    await adminAuthMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT role"), ["u1"]);
  });

  it("403s a regular user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: "user", disabled_at: null }] });

    await adminAuthMiddleware(req as Request, res as Response, next);

    const err = forbiddenError();
    expect(err.code).toBe("FORBIDDEN");
    expect(err.statusCode).toBe(403);
  });

  it("403s an admin whose account has been disabled", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ role: "admin", disabled_at: new Date("2026-01-01T00:00:00Z") }],
    });

    await adminAuthMiddleware(req as Request, res as Response, next);

    expect(forbiddenError().statusCode).toBe(403);
  });

  it("403s when the user row is gone", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await adminAuthMiddleware(req as Request, res as Response, next);

    expect(forbiddenError().code).toBe("FORBIDDEN");
  });

  it("forwards a database failure to the error handler", async () => {
    const failure = new Error("connection refused");
    mockQuery.mockRejectedValueOnce(failure);

    await adminAuthMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
