import { Router, type Request, type Response, type NextFunction } from "express";

import { listLabels, createLabel, updateLabel, deleteLabel } from "../services/labelService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const labels = await listLabels(req.userId!);
    res.json(labels);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const label = await createLabel(req.userId!, req.body);
    res.status(201).json(label);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const label = await updateLabel(req.params.id as string, req.userId!, req.body);
    res.json(label);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteLabel(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
