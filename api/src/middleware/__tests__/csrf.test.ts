import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const MOCK_SECRET = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

vi.mock("../../config.js", () => ({
  CSRF_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  IS_PRODUCTION: false,
}));

import crypto from "node:crypto";
import { csrfProtection } from "../csrf.js";

const COOKIE_NAME = "planner_csrf";

function signToken(token: string, sessionId: number | undefined): string {
  const data = sessionId !== undefined ? `${token}:${sessionId}` : token;
  return crypto.createHmac("sha256", MOCK_SECRET).update(data).digest("hex");
}

function buildCookie(token: string, sessionId?: number): string {
  return `${token}:${signToken(token, sessionId)}`;
}

describe("csrfProtection middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let statusFn: ReturnType<typeof vi.fn>;
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonFn = vi.fn();
    statusFn = vi.fn(() => ({ json: jsonFn }));
    nextFn = vi.fn();
    req = {
      headers: {},
      cookies: {},
      method: "GET",
    };
    Object.defineProperty(req, "path", { value: "/tasks", writable: true });
    res = {
      status: statusFn as unknown as Response["status"],
      cookie: vi.fn() as unknown as Response["cookie"],
      setHeader: vi.fn() as unknown as Response["setHeader"],
    };
  });

  describe("safe methods (GET, HEAD, OPTIONS)", () => {
    it("sets CSRF cookie and calls next for GET", () => {
      req.method = "GET";
      csrfProtection(req as Request, res as Response, nextFn);

      expect((res.cookie as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        COOKIE_NAME,
        expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+$/),
        expect.objectContaining({
          httpOnly: false,
          sameSite: "strict",
          path: "/",
        }),
      );
      expect(nextFn).toHaveBeenCalled();
    });

    it("sets cookie for HEAD request", () => {
      req.method = "HEAD";
      csrfProtection(req as Request, res as Response, nextFn);

      expect((res.cookie as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it("sets cookie for OPTIONS request", () => {
      req.method = "OPTIONS";
      csrfProtection(req as Request, res as Response, nextFn);

      expect((res.cookie as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe("exempt paths", () => {
    it("skips CSRF for /auth/* paths", () => {
      req.method = "POST";
      Object.defineProperty(req, "path", { value: "/auth/login", writable: true });

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusFn).not.toHaveBeenCalled();
    });

    it("skips CSRF for /health path", () => {
      req.method = "POST";
      Object.defineProperty(req, "path", { value: "/health", writable: true });

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusFn).not.toHaveBeenCalled();
    });
  });

  describe("mutation methods", () => {
    it("calls next when x-xsrf-token matches cookie with valid HMAC", () => {
      req.method = "POST";
      req.sessionId = 1;
      req.cookies = { [COOKIE_NAME]: buildCookie("valid-token", 1) };
      req.headers = { "x-xsrf-token": "valid-token" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("calls next for PATCH with matching token", () => {
      req.method = "PATCH";
      req.sessionId = 1;
      req.cookies = { [COOKIE_NAME]: buildCookie("patch-token", 1) };
      req.headers = { "x-xsrf-token": "patch-token" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("calls next for DELETE with matching token", () => {
      req.method = "DELETE";
      req.sessionId = 1;
      req.cookies = { [COOKIE_NAME]: buildCookie("delete-token", 1) };
      req.headers = { "x-xsrf-token": "delete-token" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("returns 403 when header does not match cookie token", () => {
      req.method = "POST";
      req.sessionId = 1;
      req.cookies = { [COOKIE_NAME]: buildCookie("cookie-token", 1) };
      req.headers = { "x-xsrf-token": "different-token" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "CSRF_INVALID", message: "CSRF token mismatch" },
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when HMAC is invalid", () => {
      req.method = "POST";
      req.sessionId = 1;
      req.cookies = { [COOKIE_NAME]: "valid-token:bad-hmac" };
      req.headers = { "x-xsrf-token": "valid-token" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "CSRF_INVALID", message: "Invalid CSRF signature" },
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when HMAC is bound to a different session", () => {
      req.method = "POST";
      req.sessionId = 2;
      req.cookies = { [COOKIE_NAME]: buildCookie("session-token", 1) };
      req.headers = { "x-xsrf-token": "session-token" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "CSRF_INVALID", message: "Invalid CSRF signature" },
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when header is missing", () => {
      req.method = "POST";
      req.cookies = { [COOKIE_NAME]: buildCookie("some-token") };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when cookie is missing", () => {
      req.method = "POST";
      req.headers = { "x-xsrf-token": "abc123" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when both header and cookie are missing", () => {
      req.method = "DELETE";

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when cookie has no colon separator", () => {
      req.method = "POST";
      req.cookies = { [COOKIE_NAME]: "no-hmac-separator" };
      req.headers = { "x-xsrf-token": "something" };

      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "CSRF_INVALID", message: "Malformed CSRF cookie" },
      });
    });
  });
});
