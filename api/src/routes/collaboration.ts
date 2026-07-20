import { Router, type Request, type Response, type NextFunction } from "express";

import {
  inviteToCollection,
  acceptInvitation,
  listCollaborators,
  removeCollaborator,
  assignTask,
} from "../services/collaborationService.js";

const router: ReturnType<typeof Router> = Router();

// POST /collections/:id/invitations
export const collectionCollabRouter: ReturnType<typeof Router> = Router({ mergeParams: true });

collectionCollabRouter.post("/invitations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = (req.params as { id: string }).id;
    const { invitation, token } = await inviteToCollection(collectionId, req.userId!, req.body.email);
    res.status(201).json({ invitation, token });
  } catch (err) {
    next(err);
  }
});

collectionCollabRouter.get("/collaborators", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = (req.params as { id: string }).id;
    const collaborators = await listCollaborators(collectionId, req.userId!);
    res.json(collaborators);
  } catch (err) {
    next(err);
  }
});

collectionCollabRouter.delete("/collaborators/:userId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = (req.params as { id: string }).id;
    const collaboratorUserId = (req.params as { userId: string }).userId;
    const result = await removeCollaborator(collectionId, collaboratorUserId, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/invitations/accept", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await acceptInvitation(req.body.token, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/tasks/:id/assign", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await assignTask(req.params.id as string, req.body.assigneeUserId ?? null, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
