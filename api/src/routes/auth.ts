import { Router, type Request, type Response, type NextFunction } from "express";
import { login, register, requestPasswordReset, confirmPasswordReset } from "../services/authService.js";
import { validate, type ValidationError } from "../utils/validate.js";
import { AppError } from "../utils/AppError.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  buildCookieName,
  buildCookieOptions,
  buildClearCookieOptions,
  revokeSession,
  validateSession,
} from "../services/sessionService.js";
import { CSRF_COOKIE_NAME, buildCsrfCookieOptions } from "../middleware/csrf.js";
import { securityLog } from "../utils/securityLogger.js";
import {
  checkLoginRate,
  checkRegistrationRate,
  checkPasswordResetRate,
  incrementPasswordResetAttempts,
  incrementRegistrationAttempts,
} from "../services/rateLimitService.js";

const router: ReturnType<typeof Router> = Router();

function sendRateLimited(res: Response, message: string, retryAfterSeconds: number): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    error: { code: "RATE_LIMITED", message, retryAfterSeconds },
  });
}

// Deliberately returns 201 without a session: /login is the only path that
// mints one, so cookie flags, TTL, rate limiting and the security log all live
// in one place. Clients register then log in.
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rateResult = await checkRegistrationRate(req.ip ?? "unknown");
    if (!rateResult.allowed) {
      securityLog.rateLimitExceeded(req, `register:${req.ip}`, 3);
      sendRateLimited(
        res,
        "Too many registration attempts. Please try again later.",
        rateResult.retryAfterSeconds,
      );
      return;
    }

    const { email, password, displayName, timeZone } = req.body;
    const user = await register({ email, password, displayName, timeZone });
    // Counted on success only - a rejected attempt (typo, weak password) should
    // not burn a legitimate user's quota.
    await incrementRegistrationAttempts(req.ip ?? "unknown");
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
      sendRateLimited(
        res,
        "Too many failed login attempts. Please try again later.",
        rateResult.retryAfterSeconds,
      );
      return;
    }

    const { user, rawToken } = await login(email, password, req.ip);
    securityLog.authLoginSuccess(req, user.id);
    res.cookie(buildCookieName(), rawToken, buildCookieOptions());
    res.json({ user });
  } catch (err) {
    // A disabled account must look exactly like a wrong password to the
    // client; the real reason only reaches the security log.
    if (err instanceof AppError && err.code === "ACCOUNT_DISABLED") {
      securityLog.authLoginFailure(req, "account-disabled");
      next(
        new AppError({
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
          statusCode: 401,
        }),
      );
      return;
    }
    next(err);
  }
});

// Deliberately not behind authMiddleware, and deliberately always 200.
//
// Logging out is idempotent: there is nothing a caller can do about "your
// session was already gone", and gating it on a live session meant the one
// request whose entire purpose is to tear a session down was the request that
// failed loudest when that session had expired - a 401 in the console and a
// rejected promise, on every single expiry.
//
// Dropping the auth gate does not open a cross-site logout: the session cookie
// is SameSite=Lax, so a POST from another origin carries no cookie and there is
// no session for this handler to find.
router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken = req.cookies?.[buildCookieName()] as string | undefined;
    if (rawToken) {
      const session = await validateSession(rawToken);
      if (session) {
        await revokeSession(session.sessionId);
        securityLog.authLogout(req, session.userId, session.sessionId);
      }
    }
    res.clearCookie(buildCookieName(), buildClearCookieOptions());
    res.clearCookie(CSRF_COOKIE_NAME, buildCsrfCookieOptions());
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rateResult = await checkPasswordResetRate(req.ip ?? "unknown");
    if (!rateResult.allowed) {
      sendRateLimited(
        res,
        "Too many password reset requests. Please try again later.",
        rateResult.retryAfterSeconds,
      );
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
      "SELECT id, email, display_name, role, disabled_at FROM users WHERE id = $1",
      [req.userId],
    );
    if (result.rows.length === 0 || result.rows[0].disabled_at) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not found" },
      });
      return;
    }
    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
