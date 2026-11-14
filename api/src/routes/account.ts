import { Router, type Request, type Response, type NextFunction } from "express";
import { exportUserData, deleteUserAccount } from "../services/accountService.js";
import { buildCookieName, buildClearCookieOptions } from "../services/sessionService.js";
import { CSRF_COOKIE_NAME, buildCsrfCookieOptions } from "../middleware/csrf.js";

const router: ReturnType<typeof Router> = Router();

router.get("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await exportUserData(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteUserAccount(req.userId!);
    res.clearCookie(buildCookieName(), buildClearCookieOptions());
    res.clearCookie(CSRF_COOKIE_NAME, buildCsrfCookieOptions());
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
