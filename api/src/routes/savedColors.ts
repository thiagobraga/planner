import { Router, type Request, type Response, type NextFunction } from "express";

import { listSavedColors, addSavedColor } from "../services/savedColorService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const colors = await listSavedColors(req.userId!);
    res.json(colors);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const colors = await addSavedColor(req.userId!, req.body?.color);
    res.status(201).json(colors);
  } catch (err) {
    next(err);
  }
});

export default router;
