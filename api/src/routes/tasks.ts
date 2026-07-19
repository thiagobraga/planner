import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { createTask, updateTask, completeTask, reopenTask, reorderTask, moveTask, deleteTask } from "../services/taskService.js";

const router: ReturnType<typeof Router> = Router();

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await createTask(req.userId!, req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await updateTask(req.params.id as string, req.userId!, req.body);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/complete", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await completeTask(req.params.id as string, req.userId!);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reopen", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await reopenTask(req.params.id as string, req.userId!);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/reorder", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await reorderTask(req.params.id as string, req.userId!, req.body.position);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Structural move: tree position, list membership and surrounding order, in one
// transaction. `/reorder` above stays for older clients but only shifts a task
// within its existing sibling list.
router.patch("/:id/move", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await moveTask(req.params.id as string, req.userId!, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteTask(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
