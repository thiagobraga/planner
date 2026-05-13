import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  inviteToProject,
  acceptInvitation,
  listCollaborators,
  removeCollaborator,
  assignTask,
} from "../services/collaborationService.js";

const router: ReturnType<typeof Router> = Router();

// POST /projects/:id/invitations
export const projectCollabRouter: ReturnType<typeof Router> = Router({ mergeParams: true });

projectCollabRouter.post("/invitations", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req.params as { id: string }).id;
    const { invitation, token } = await inviteToProject(projectId, req.userId!, req.body.email);
    res.status(201).json({ invitation, token });
  } catch (err) {
    next(err);
  }
});

projectCollabRouter.get("/collaborators", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req.params as { id: string }).id;
    const collaborators = await listCollaborators(projectId, req.userId!);
    res.json(collaborators);
  } catch (err) {
    next(err);
  }
});

projectCollabRouter.delete("/collaborators/:userId", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req.params as { id: string }).id;
    const collaboratorUserId = (req.params as { userId: string }).userId;
    const result = await removeCollaborator(projectId, collaboratorUserId, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/invitations/accept", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await acceptInvitation(req.body.token, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/tasks/:id/assign", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await assignTask(req.params.id as string, req.body.assigneeUserId ?? null, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
