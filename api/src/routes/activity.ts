import { Router, type Request, type Response, type NextFunction } from "express";

import { listActivity } from "../services/activityService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = typeof req.query.collection_id === "string" ? req.query.collection_id : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listActivity(req.userId!, { collectionId, cursor });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
