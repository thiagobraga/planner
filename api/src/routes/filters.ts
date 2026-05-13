import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  createFilter,
  updateFilter,
  listFilters,
  deleteFilter,
  evaluateSavedFilter,
} from "../services/filterService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = await listFilters(req.userId!);
    res.json(filters);
  } catch (err) {
    next(err);
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = await createFilter(req.userId!, req.body);
    res.status(201).json(filter);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = await updateFilter(req.params.id as string, req.userId!, req.body);
    res.json(filter);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteFilter(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/results", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await evaluateSavedFilter(req.params.id as string, req.userId!, today);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

export default router;
