import { Router, type Request, type Response, type NextFunction } from "express";

import {
  getCounts,
  getSystemHealth,
  getAuthStats,
} from "../services/adminStatsService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/counts", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getCounts());
  } catch (err) {
    next(err);
  }
});

router.get("/health", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSystemHealth());
  } catch (err) {
    next(err);
  }
});

router.get("/auth", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getAuthStats());
  } catch (err) {
    next(err);
  }
});

export default router;
