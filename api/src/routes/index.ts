import { Router, type Router as RouterType } from "express";
import authRoutes from "./auth.js";
import taskRoutes from "./tasks.js";
import labelRoutes from "./labels.js";
import projectRoutes from "./projects.js";
import sectionRoutes from "./sections.js";
import viewRoutes from "./views.js";
import filterRoutes from "./filters.js";
import searchRoutes from "./search.js";

const router: RouterType = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
router.use("/labels", labelRoutes);
router.use("/projects", projectRoutes);
router.use("/views", viewRoutes);
router.use("/filters", filterRoutes);
router.use("/search", searchRoutes);
router.use("/", sectionRoutes);

export default router;
