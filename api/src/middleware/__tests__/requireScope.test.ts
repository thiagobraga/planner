import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { enforceTokenScope, requireSession } from "../requireScope.js";

describe("token access middleware", () => {
  let res: Partial<Response>;
  let status: ReturnType<typeof vi.fn>;
  let json: ReturnType<typeof vi.fn>;
  let next: NextFunction & Mock<(err?: unknown) => void>;

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn(() => ({ json }));
    res = { status: status as unknown as Response["status"] };
    next = vi.fn() as NextFunction & Mock<(err?: unknown) => void>;
  });

  describe("enforceTokenScope", () => {
    it.each(["POST", "PATCH", "DELETE"])("blocks %s from a read-only token", (method) => {
      const req = { method, authMethod: "token", tokenScopes: ["read"] } as Request;

      enforceTokenScope(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
        error: { code: "INSUFFICIENT_SCOPE", message: "This API token is read-only" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("allows GET from a read-only token", () => {
      enforceTokenScope({ method: "GET", authMethod: "token", tokenScopes: ["read"] } as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it("allows writes from a write token", () => {
      enforceTokenScope(
        { method: "POST", authMethod: "token", tokenScopes: ["read", "write"] } as Request,
        res as Response,
        next,
      );
      expect(next).toHaveBeenCalled();
    });

    it("leaves scope on the MCP endpoint to the MCP server", () => {
      const req = { method: "POST", path: "/mcp", authMethod: "token", tokenScopes: ["read"] } as unknown as Request;
      enforceTokenScope(req, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it("never restricts session requests", () => {
      enforceTokenScope({ method: "DELETE", authMethod: "session" } as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("requireSession", () => {
    it("rejects token requests", () => {
      requireSession({ method: "GET", authMethod: "token" } as Request, res as Response, next);
      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("allows session requests", () => {
      requireSession({ method: "GET", authMethod: "session" } as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
