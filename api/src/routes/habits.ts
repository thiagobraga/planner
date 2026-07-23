import { Router, type Request, type Response, type NextFunction } from "express";

import {
  listHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
  moveHabit,
  listGroups,
} from "../services/habitService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [habits, groups] = await Promise.all([
      listHabits(req.userId!),
      listGroups(req.userId!),
    ]);
    res.json({ habits, groups });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, parentId, groupId } = req.body ?? {};
    res.status(201).json(await createHabit(req.userId!, { name, parentId, groupId }));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateHabit(req.userId!, req.params.id as string, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

// Structural move: hierarchy, group and surrounding order, in one transaction.
router.patch("/:id/move", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await moveHabit(req.userId!, req.params.id as string, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteHabit(req.userId!, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.put("/:id/completions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, isCompleted } = req.body ?? {};
    res.json(await toggleCompletion(req.userId!, req.params.id as string, date, isCompleted));
  } catch (err) {
    next(err);
  }
});

export default router;
