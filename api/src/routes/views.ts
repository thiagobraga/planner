import { Router, type Request, type Response, type NextFunction } from "express";

import { getInboxView, getCollectionView } from "../services/viewService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/inbox", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getInboxView(req.userId!);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

router.get("/collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getCollectionView(req.userId!, req.params.id as string);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

export default router;
