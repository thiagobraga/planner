import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getTodayView, getUpcomingView, getInboxView } from "../services/viewService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/today", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getTodayView(req.userId!);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

router.get("/upcoming", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(String(req.query.days ?? "7"), 10);
    const view = await getUpcomingView(req.userId!, days);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

router.get("/inbox", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getInboxView(req.userId!);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

export default router;
