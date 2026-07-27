import type { Request, Response, NextFunction } from "express";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

/**
 * Gate for /admin routes. Runs after authMiddleware, which has already
 * validated the session and set req.userId.
 *
 * The role lookup is a separate query rather than something authMiddleware
 * fetches: that middleware runs on every API request and only sessions matter
 * there, so widening its query would cost a users join on every call to save
 * one indexed read on the handful of admin ones.
 */
export async function adminAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await pool.query(
      "SELECT role, disabled_at FROM users WHERE id = $1",
      [req.userId],
    );

    const user = result.rows[0];

    if (!user || user.disabled_at || user.role !== "admin") {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Admin access required",
        statusCode: 403,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
