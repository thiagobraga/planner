import { Router, type Request, type Response, type NextFunction } from "express";
import { login, register, requestPasswordReset, confirmPasswordReset } from "../services/authService.js";
import { validate, type ValidationError } from "../utils/validate.js";
import { authMiddleware } from "../middleware/auth.js";
import pool from "../db/pool.js";

const router: ReturnType<typeof Router> = Router();

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName } = req.body;
    const result = await register({ email, password, displayName });
    res.status(201).json(result);
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

    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/logout", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.sessionId) {
      await pool.query("DELETE FROM sessions WHERE id = $1", [req.sessionId]);
    }
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

export default router;
