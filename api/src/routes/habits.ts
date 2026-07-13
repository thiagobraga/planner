import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  listHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
} from "../services/habitService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listHabits(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, note } = req.body ?? {};
    res.status(201).json(await createHabit(req.userId!, name, note));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateHabit(req.userId!, req.params.id as string, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteHabit(req.userId!, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.put("/:id/completions", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, isCompleted } = req.body ?? {};
    res.json(await toggleCompletion(req.userId!, req.params.id as string, date, isCompleted));
  } catch (err) {
    next(err);
  }
});

export default router;
