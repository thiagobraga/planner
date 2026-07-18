import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  archiveCollection,
} from "../services/collectionService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collections = await listCollections(req.userId!);
    res.json(collections);
  } catch (err) {
    next(err);
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await createCollection(req.userId!, req.body);
    res.status(201).json(collection);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await updateCollection(req.params.id as string, req.userId!, req.body);
    res.json(collection);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteCollection(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/archive", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await archiveCollection(req.params.id as string, req.userId!);
    res.json(collection);
  } catch (err) {
    next(err);
  }
});

export default router;
