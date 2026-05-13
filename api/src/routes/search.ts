import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { searchEntities } from "../services/searchService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q ?? "");
    const results = await searchEntities(req.userId!, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
