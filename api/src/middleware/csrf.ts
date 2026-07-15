import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("XSRF-TOKEN", token, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    next();
    return;
  }

  const headerToken = req.headers["x-xsrf-token"] as string | undefined;
  const cookieToken = req.cookies?.["XSRF-TOKEN"];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    res.status(403).json({
      error: { code: "CSRF_INVALID", message: "Invalid or missing CSRF token" },
    });
    return;
  }

  next();
}
