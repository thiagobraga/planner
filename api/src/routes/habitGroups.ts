import { Router, type Request, type Response, type NextFunction } from "express";

import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  moveHabitGroup,
} from "../services/habitService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listGroups(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body ?? {};
    res.status(201).json(await createGroup(req.userId!, name));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateGroup(req.userId!, req.params.id as string, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/move", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await moveHabitGroup(req.userId!, req.params.id as string, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteGroup(req.userId!, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
