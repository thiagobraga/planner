import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { createReminder, listRemindersForTask, deleteReminder } from "../services/reminderService.js";

const router: ReturnType<typeof Router> = Router();

// Task-scoped routes mounted under /tasks/:taskId/reminders
export const taskReminderRouter: ReturnType<typeof Router> = Router({ mergeParams: true });

taskReminderRouter.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = (req.params as { taskId: string }).taskId;
    const reminders = await listRemindersForTask(taskId, req.userId!);
    res.json(reminders);
  } catch (err) {
    next(err);
  }
});

taskReminderRouter.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = (req.params as { taskId: string }).taskId;
    const reminder = await createReminder(taskId, req.userId!, req.body.remindAt);
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteReminder(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
