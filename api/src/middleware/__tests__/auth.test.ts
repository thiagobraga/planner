import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockValidateSession = vi.hoisted(() => vi.fn());
const mockBuildCookieName = vi.hoisted(() => vi.fn());
const mockBuildCookieOptions = vi.hoisted(() => vi.fn());
const mockNeedsTouch = vi.hoisted(() => vi.fn());
const mockTouchSession = vi.hoisted(() => vi.fn());

vi.mock("../../services/sessionService.js", () => ({
  validateSession: mockValidateSession,
  buildCookieName: mockBuildCookieName,
  buildCookieOptions: mockBuildCookieOptions,
  needsTouch: mockNeedsTouch,
  touchSession: mockTouchSession,
}));

import { authMiddleware } from "../auth.js";

describe("authMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  // express's NextFunction is an overloaded interface, so Mock<NextFunction>
  // resolves to the wrong call signature. Intersect instead: assignable where a
  // NextFunction is expected, while keeping the mock assertion helpers.
  let next: NextFunction & Mock<(err?: unknown) => void>;
  let cookie: ReturnType<typeof vi.fn>;

  const COOKIE_OPTS = { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 1000 };

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn(() => ({ json }));
    cookie = vi.fn();
    next = vi.fn() as NextFunction & Mock<(err?: unknown) => void>;
    req = {
      cookies: {},
    };
    res = {
      status: status as unknown as Response["status"],
      cookie: cookie as unknown as Response["cookie"],
    };
    mockBuildCookieName.mockReturnValue("planner_session");
    mockBuildCookieOptions.mockReturnValue(COOKIE_OPTS);
    mockValidateSession.mockReset();
    mockNeedsTouch.mockReset();
    mockTouchSession.mockReset();
  });

  it("sets req.userId and req.sessionId and calls next for valid session", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42, lastSeenAt: new Date() });
    mockNeedsTouch.mockReturnValue(false);

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

  it("touches session when needsTouch returns true", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42, lastSeenAt: null });
    mockNeedsTouch.mockReturnValue(true);
    mockTouchSession.mockResolvedValue(undefined);

    await authMiddleware(req as Request, res as Response, next);

    expect(mockTouchSession).toHaveBeenCalledWith(42);
    expect(next).toHaveBeenCalled();
  });

  it("does not touch session when needsTouch returns false", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42, lastSeenAt: new Date() });
    mockNeedsTouch.mockReturnValue(false);

    await authMiddleware(req as Request, res as Response, next);

    expect(mockTouchSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  // The cookie carries its own fixed expiry. Sliding the server-side session
  // without re-issuing it leaves the browser dropping a cookie whose session is
  // still perfectly valid.
  it("re-issues the session cookie whenever it slides the session", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42, lastSeenAt: null });
    mockNeedsTouch.mockReturnValue(true);
    mockTouchSession.mockResolvedValue(undefined);

    await authMiddleware(req as Request, res as Response, next);

    expect(cookie).toHaveBeenCalledWith("planner_session", "valid-token", COOKIE_OPTS);
  });

  it("leaves the cookie alone when the session was not slid", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42, lastSeenAt: new Date() });
    mockNeedsTouch.mockReturnValue(false);

    await authMiddleware(req as Request, res as Response, next);

    expect(cookie).not.toHaveBeenCalled();
  });

  // A touch failure must not take the request down with it - the session is
  // valid, the slide is an optimization.
  it("still serves the request when the touch write fails", async () => {
    req.cookies = { planner_session: "valid-token" };
    mockValidateSession.mockResolvedValue({ userId: "u1", sessionId: 42, lastSeenAt: null });
    mockNeedsTouch.mockReturnValue(true);
    mockTouchSession.mockRejectedValue(new Error("db down"));

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
});
