import { Router, type Request, type Response, type NextFunction } from "express";

import { listActivity } from "../services/activityService.js";
import { AppError } from "../utils/AppError.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = typeof req.query.collection_id === "string" ? req.query.collection_id : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const tokenId = typeof req.query.token_id === "string" ? req.query.token_id : undefined;
    if (tokenId !== undefined && !UUID.test(tokenId)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "token_id must be a UUID", statusCode: 400 });
    }
    const source = req.query.source === "token" ? "token" : undefined;
    const result = await listActivity(req.userId!, { collectionId, cursor, tokenId, source });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
