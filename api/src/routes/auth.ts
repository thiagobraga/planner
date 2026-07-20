import { Router, type Request, type Response, type NextFunction } from "express";
import { login, register, requestPasswordReset, confirmPasswordReset } from "../services/authService.js";
import { validate, type ValidationError } from "../utils/validate.js";
import { authMiddleware } from "../middleware/auth.js";
import { buildCookieName, buildCookieOptions, revokeSession } from "../services/sessionService.js";
import { securityLog } from "../utils/securityLogger.js";
import {
  checkLoginRate,
  checkRegistrationRate,
  checkPasswordResetRate,
  incrementPasswordResetAttempts,
} from "../services/rateLimitService.js";

const router: ReturnType<typeof Router> = Router();

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rateResult = await checkRegistrationRate(req.ip ?? "unknown");
    if (!rateResult.allowed) {
      securityLog.rateLimitExceeded(req, `register:${req.ip}`, 3);
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many registration attempts. Please try again later." },
      });
      return;
    }

    const { email, password } = req.body;
    const user = await register({ email, password });
    securityLog.authRegisterSuccess(req, user.id);
    res.status(201).json({ user });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "EMAIL_IN_USE") {
      securityLog.authRegisterFailure(req, "email-exists");
    }
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

    const rateResult = await checkLoginRate(email, req.ip ?? "unknown");
    if (!rateResult.allowed) {
      securityLog.authLoginFailure(req, "rate-limited");
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many failed login attempts. Please try again later." },
      });
      return;
    }

    const { user, rawToken } = await login(email, password, req.ip);
    securityLog.authLoginSuccess(req, user.id);
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
      securityLog.authLogout(req, req.userId!, req.sessionId);
    }
    res.clearCookie(buildCookieName(), { path: "/" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rateResult = await checkPasswordResetRate(req.ip ?? "unknown");
    if (!rateResult.allowed) {
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many password reset requests. Please try again later." },
      });
      return;
    }

    const { email } = req.body;
    const result = await requestPasswordReset(email);
    await incrementPasswordResetAttempts(req.ip ?? "unknown");
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
