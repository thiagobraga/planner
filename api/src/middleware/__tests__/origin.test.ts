import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../config.js", () => ({
  CORS_ORIGIN: "https://planner.example.com",
}));

import { originCheck } from "../origin.js";

describe("originCheck middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let statusFn: ReturnType<typeof vi.fn>;
  // express's NextFunction is an overloaded interface, so Mock<NextFunction>
  // resolves to the wrong call signature. Intersect instead: assignable where a
  // NextFunction is expected, while keeping the mock assertion helpers.
  let nextFn: NextFunction & Mock<(err?: unknown) => void>;

  beforeEach(() => {
    jsonFn = vi.fn();
    statusFn = vi.fn(() => ({ json: jsonFn }));
    nextFn = vi.fn() as NextFunction & Mock<(err?: unknown) => void>;
    req = {
      headers: {},
      method: "POST",
    };
    res = {
      status: statusFn as unknown as Response["status"],
      setHeader: vi.fn() as unknown as Response["setHeader"],
    };
  });

  describe("safe methods", () => {
    it("passes through GET requests", () => {
      req.method = "GET";
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it("passes through HEAD requests", () => {
      req.method = "HEAD";
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it("passes through OPTIONS requests", () => {
      req.method = "OPTIONS";
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe("unsafe methods with JSON content type", () => {
    it("passes through POST with application/json", () => {
      req.headers = { "content-type": "application/json" };
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it("passes through PATCH with application/json", () => {
      req.method = "PATCH";
      req.headers = { "content-type": "application/json" };
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it("passes through DELETE with application/json", () => {
      req.method = "DELETE";
      req.headers = { "content-type": "application/json" };
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe("non-JSON unsafe requests", () => {
    it("rejects POST with disallowed origin", () => {
      req.headers = { origin: "https://evil.com" };
      originCheck(req as Request, res as Response, nextFn);
      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "ORIGIN_DENIED", message: "Origin not allowed" },
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("allows POST with matching origin", () => {
      req.headers = { origin: "https://planner.example.com" };
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it("rejects POST with disallowed Referer origin when Origin is absent", () => {
      req.headers = { referer: "https://evil.com/some-page" };
      originCheck(req as Request, res as Response, nextFn);
      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "ORIGIN_DENIED", message: "Referer origin not allowed" },
      });
    });

    it("allows POST with matching Referer origin when Origin is absent", () => {
      req.headers = { referer: "https://planner.example.com/tasks" };
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it("rejects POST with invalid Referer URL", () => {
      req.headers = { referer: "not-a-url" };
      originCheck(req as Request, res as Response, nextFn);
      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { code: "ORIGIN_DENIED", message: "Invalid Referer" },
      });
    });

    it("passes through when no Origin or Referer is present", () => {
      originCheck(req as Request, res as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
