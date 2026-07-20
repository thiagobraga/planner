import { Router, type Request, type Response, type NextFunction } from "express";

import { getPreferences, updatePreferences } from "../services/preferencesService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await getPreferences(req.userId!);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await updatePreferences(req.userId!, req.body);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

export default router;
