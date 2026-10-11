import { Router, type Request, type Response, type NextFunction } from "express";
import { getDailyRange } from "../services/dailyService.js";

const router: ReturnType<typeof Router> = Router();

router.get(/^\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getDailyRange(req.userId!, req.params[0] as string, req.params[1] as string));
  } catch (error) {
    next(error);
  }
});

export default router;
