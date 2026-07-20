import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../config.js", () => ({
  CSRF_SECRET: "a".repeat(32),
  IS_PRODUCTION: false,
}));

import { csrfProtection } from "../csrf.js";

const COOKIE_NAME = "planner_csrf";

function buildCookie(token: string, hmac: string): string {
  return `${token}:${hmac}`;
}

describe("csrfProtection middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let statusFn: ReturnType<typeof vi.fn>;
  let cookieFn: ReturnType<typeof vi.fn>;
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonFn = vi.fn();
    statusFn = vi.fn(() => ({ json: jsonFn }));
    cookieFn = vi.fn();
    nextFn = vi.fn();
    req = {
      headers: {},
      cookies: {},
      method: "GET",
      path: "/tasks",
    };
    res = {
      status: statusFn as unknown as Response["status"],
      cookie: cookieFn as unknown as Response["cookie"],
    };
  });

  describe("safe methods (GET, HEAD, OPTIONS)", () => {
    it("sets CSRF cookie and calls next for GET", () => {
      req.method = "GET";
      csrfProtection(req as Request, res as Response, nextFn);

      expect(cookieFn).toHaveBeenCalledWith(
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

      expect(cookieFn).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it("sets cookie for OPTIONS request", () => {
      req.method = "OPTIONS";
      csrfProtection(req as Request, res as Response, nextFn);

      expect(cookieFn).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it("includes session-bound HMAC when sessionId is present", () => {
      req.method = "GET";
      req.sessionId = 42;

      csrfProtection(req as Request, res as Response, nextFn);

      const callArgs = cookieFn.mock.calls[0];
      const cookieValue = callArgs[1] as string;
      expect(cookieValue).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe("exempt paths", () => {
    it("skips CSRF for /auth paths", () => {
      req.method = "POST";
      req.path = "/auth/login";

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusFn).not.toHaveBeenCalled();
    });

    it("skips CSRF for /health path", () => {
      req.method = "POST";
      req.path = "/health";

      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusFn).not.toHaveBeenCalled();
    });
  });

  describe("mutation methods", () => {
    it("calls next when x-xsrf-token matches cookie with valid HMAC", () => {
      req.method = "POST";
      req.sessionId = 1;

      csrfProtection(req as Request, res as Response, nextFn);

      const cookieValue = cookieFn.mock.calls[0][1] as string;
      const token = cookieValue.split(":")[0];

      req.cookies = { [COOKIE_NAME]: cookieValue };
      req.headers = { "x-xsrf-token": token };

      vi.clearAllMocks();
      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("calls next for PATCH with matching token", () => {
      req.method = "PATCH";
      req.sessionId = 1;

      csrfProtection(req as Request, res as Response, nextFn);

      const cookieValue = cookieFn.mock.calls[0][1] as string;
      const token = cookieValue.split(":")[0];

      req.cookies = { [COOKIE_NAME]: cookieValue };
      req.headers = { "x-xsrf-token": token };

      vi.clearAllMocks();
      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("calls next for DELETE with matching token", () => {
      req.method = "DELETE";
      req.sessionId = 1;

      csrfProtection(req as Request, res as Response, nextFn);

      const cookieValue = cookieFn.mock.calls[0][1] as string;
      const token = cookieValue.split(":")[0];

      req.cookies = { [COOKIE_NAME]: cookieValue };
      req.headers = { "x-xsrf-token": token };

      vi.clearAllMocks();
      csrfProtection(req as Request, res as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("returns 403 when header does not match cookie token", () => {
      req.method = "POST";
      req.sessionId = 1;

      csrfProtection(req as Request, res as Response, nextFn);

      const cookieValue = cookieFn.mock.calls[0][1] as string;

      req.cookies = { [COOKIE_NAME]: cookieValue };
      req.headers = { "x-xsrf-token": "different-token" };

      vi.clearAllMocks();
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

      const badCookie = buildCookie("valid-token", "bad-hmac-value");
      req.cookies = { [COOKIE_NAME]: badCookie };
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
      req.sessionId = 1;

      csrfProtection(req as Request, res as Response, nextFn);

      const cookieValue = cookieFn.mock.calls[0][1] as string;
      const token = cookieValue.split(":")[0];

      req.cookies = { [COOKIE_NAME]: cookieValue };
      req.headers = { "x-xsrf-token": token };
      req.sessionId = 2;

      vi.clearAllMocks();
      csrfProtection(req as Request, res as Response, nextFn);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "CSRF_INVALID", message: "Invalid CSRF signature" },
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("returns 403 when header is missing", () => {
      req.method = "POST";
      req.cookies = { [COOKIE_NAME]: "token:hmac" };

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
