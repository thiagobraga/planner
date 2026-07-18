import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
} from "../services/projectService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await listProjects(req.userId!);
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await createProject(req.userId!, req.body);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await updateProject(req.params.id as string, req.userId!, req.body);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteProject(req.params.id as string, req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/archive", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await archiveProject(req.params.id as string, req.userId!);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

export default router;
