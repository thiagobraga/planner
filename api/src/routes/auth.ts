import { Router, type Request, type Response, type NextFunction } from "express";
import { login, register, requestPasswordReset, confirmPasswordReset } from "../services/authService.js";
import { validate, type ValidationError } from "../utils/validate.js";
import { authMiddleware } from "../middleware/auth.js";
import { buildCookieName, buildCookieOptions, revokeSession } from "../services/sessionService.js";

const router: ReturnType<typeof Router> = Router();

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await register({ email, password });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const errors: ValidationError[] = [];
    if (!email || typeof email !== "string") {
      errors.push({ field: "email", message: "Email is required" });
    }
    if (!password || typeof password !== "string") {
      errors.push({ field: "password", message: "Password is required" });
    }
    validate(errors);

    const { user, rawToken } = await login(email, password);
    res.cookie(buildCookieName(), rawToken, buildCookieOptions());
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.sessionId) {
      await revokeSession(req.sessionId);
    }
    res.clearCookie(buildCookieName(), { path: "/" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const result = await requestPasswordReset(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password/confirm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;

    const errors: ValidationError[] = [];
    if (!token || typeof token !== "string") {
      errors.push({ field: "token", message: "Token is required" });
    }
    validate(errors);

    const result = await confirmPasswordReset(token, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = (await import("../db/pool.js")).default;
    const result = await pool.query(
      "SELECT id, email, display_name FROM users WHERE id = $1",
      [req.userId],
    );
    if (result.rows.length === 0) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not found" },
      });
      return;
    }
    const user = result.rows[0];
    res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    next(err);
  }
});

export default router;
