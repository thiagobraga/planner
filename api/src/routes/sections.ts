import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from "../services/sectionService.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/projects/:id/sections
router.get("/projects/:id/sections", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await listSections(req.params.id as string, req.userId!);
    res.json(sections);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:id/sections
router.post("/projects/:id/sections", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await createSection(req.params.id as string, req.userId!, req.body);
    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/sections/:id
router.patch("/sections/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await updateSection(req.params.id as string, req.userId!, req.body);
    res.json(section);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/sections/:id
router.delete("/sections/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteSection(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
