import { Router, type Request, type Response, type NextFunction } from "express";

import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  archiveCollection,
} from "../services/collectionService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collections = await listCollections(req.userId!);
    res.json(collections);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await createCollection(req.userId!, req.body);
    res.status(201).json(collection);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await updateCollection(req.params.id as string, req.userId!, req.body);
    res.json(collection);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteCollection(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await archiveCollection(req.params.id as string, req.userId!);
    res.json(collection);
  } catch (err) {
    next(err);
  }
});

export default router;
