import { Router, type Request, type Response, type NextFunction } from "express";

import { listComments, createComment, updateComment, deleteComment } from "../services/commentService.js";

const router: ReturnType<typeof Router> = Router();

export const taskCommentRouter: ReturnType<typeof Router> = Router({ mergeParams: true });

taskCommentRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = (req.params as { taskId: string }).taskId;
    const comments = await listComments(taskId, req.userId!);
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

taskCommentRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = (req.params as { taskId: string }).taskId;
    const comment = await createComment(taskId, req.userId!, req.body.body);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comment = await updateComment(req.params.id as string, req.userId!, req.body.body);
    res.json(comment);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteComment(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
