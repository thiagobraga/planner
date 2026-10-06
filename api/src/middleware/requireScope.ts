import type { Request, Response, NextFunction } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Every MCP call is a POST, reads included; the MCP server enforces scope by
// only registering write tools for write tokens.
const SCOPE_EXEMPT_PATHS = new Set(["/mcp"]);

/** A read-only API token may look but not touch. Session requests pass untouched. */
export function enforceTokenScope(req: Request, res: Response, next: NextFunction): void {
  if (
    req.authMethod === "token" &&
    !SAFE_METHODS.has(req.method) &&
    !SCOPE_EXEMPT_PATHS.has(req.path) &&
    !req.tokenScopes?.includes("write")
  ) {
    res.status(403).json({
      error: { code: "INSUFFICIENT_SCOPE", message: "This API token is read-only" },
    });
    return;
  }
  next();
}

/**
 * For routes a leaked token must never reach: minting or revoking tokens
 * (it could hide itself or spawn more) and admin.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (req.authMethod === "token") {
    res.status(403).json({
      error: { code: "SESSION_REQUIRED", message: "This action requires signing in to Planner" },
    });
    return;
  }
  next();
}
