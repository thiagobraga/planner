import { Router, type Router as RouterType } from "express";
import authRoutes from "./auth.js";
import taskRoutes from "./tasks.js";
import labelRoutes from "./labels.js";
import projectRoutes from "./projects.js";
import sectionRoutes from "./sections.js";

const router: RouterType = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
router.use("/labels", labelRoutes);
router.use("/projects", projectRoutes);
router.use("/", sectionRoutes);

export default router;
