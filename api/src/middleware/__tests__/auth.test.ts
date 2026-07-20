import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockValidateSession = vi.hoisted(() => vi.fn());
const mockBuildCookieName = vi.hoisted(() => vi.fn());
const mockShouldTouch = vi.hoisted(() => vi.fn());
const mockTouchSession = vi.hoisted(() => vi.fn());

vi.mock("../../services/sessionService.js", () => ({
  validateSession: mockValidateSession,
  buildCookieName: mockBuildCookieName,
  shouldTouch: mockShouldTouch,
  touchSession: mockTouchSession,
}));

import { authMiddleware } from "../auth.js";

describe("authMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn(() => ({ json }));
    next = vi.fn();
    req = {
      cookies: {},
    };
    res = {
      status: status as unknown as Response["status"],
    };
    mockBuildCookieName.mockReturnValue("planner_session");
    mockValidateSession.mockReset();
    mockShouldTouch.mockReset();
    mockTouchSession.mockReset();
  });

  it("sets req.userId and req.sessionId and calls next for valid session", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42 });
    mockShouldTouch.mockReturnValue(false);

    await authMiddleware(req as Request, res as Response, next);

    expect(req.userId).toBe("u1");
    expect(req.sessionId).toBe(42);
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when session cookie is missing", async () => {
    req.cookies = {};

    await authMiddleware(req as Request, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid session" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when session is invalid", async () => {
    req.cookies = { planner_session: "invalid-token" };
    mockValidateSession.mockResolvedValue(null);

    await authMiddleware(req as Request, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: { code: "UNAUTHORIZED", message: "Session expired or revoked" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("touches session when shouldTouch returns true", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42 });
    mockShouldTouch.mockReturnValue(true);
    mockTouchSession.mockResolvedValue(undefined);

    await authMiddleware(req as Request, res as Response, next);

    expect(mockTouchSession).toHaveBeenCalledWith(42);
    expect(next).toHaveBeenCalled();
  });

  it("does not touch session when shouldTouch returns false", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42 });
    mockShouldTouch.mockReturnValue(false);

    await authMiddleware(req as Request, res as Response, next);

    expect(mockTouchSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
