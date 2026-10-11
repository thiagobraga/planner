import { Router, type Request, type Response, type NextFunction } from "express";

import { getDailyView } from "../services/dailyService.js";

const router: ReturnType<typeof Router> = Router();

// The regex keeps a malformed range out of the handler entirely (404); the
// service then checks it is a real calendar range of at most 42 days.
router.get(/^\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [from, to] = [req.params[0] as string, req.params[1] as string];
    const view = await getDailyView(req.userId!, from, to);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

export default router;
