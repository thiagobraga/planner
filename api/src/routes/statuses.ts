import { Router, type Request, type Response, type NextFunction } from "express";

import {
  listStatuses,
  createStatus,
  ensureCollectionStatuses,
  updateStatus,
  deleteStatus,
} from "../services/statusService.js";
import { ensureSeedLabels } from "../services/labelService.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/collections/:id/statuses
router.get("/collections/:id/statuses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statuses = await listStatuses(req.params.id as string, req.userId!);
    res.json(statuses);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/collections/:id/statuses
router.post("/collections/:id/statuses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await createStatus(req.params.id as string, req.userId!, req.body);
    res.status(201).json(status);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/collections/:id/statuses/seed
router.post("/collections/:id/statuses/seed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureSeedLabels(req.userId!);
    const statuses = await ensureCollectionStatuses(req.params.id as string, req.userId!);
    res.json(statuses);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/statuses/:id
router.patch("/statuses/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await updateStatus(req.params.id as string, req.userId!, req.body);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/statuses/:id?reassignTo=<uuid>
router.delete("/statuses/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reassignToStatusId = typeof req.query.reassignTo === "string" ? req.query.reassignTo : undefined;
    const result = await deleteStatus(req.params.id as string, req.userId!, { reassignToStatusId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
