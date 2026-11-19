import { Router, type Request, type Response, type NextFunction } from "express";
import { getTaskDocument, putTaskDocument } from "../services/documentService.js";
import { UUID_RE } from "../services/document/schema.js";
import { AppError } from "../utils/AppError.js";

// Mounted at /tasks/:taskId/document.
const router: ReturnType<typeof Router> = Router({ mergeParams: true });

function taskIdOf(req: Request): string {
  const { taskId } = req.params as { taskId: string };
  if (!UUID_RE.test(taskId)) throw new AppError({ code: "NOT_FOUND", message: "Task not found", statusCode: 404 });
  return taskId;
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getTaskDocument(taskIdOf(req), req.userId!));
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await putTaskDocument(taskIdOf(req), req.userId!, req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
