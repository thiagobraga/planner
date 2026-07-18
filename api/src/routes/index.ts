import { Router, type Router as RouterType } from "express";
import authRoutes from "./auth.js";
import taskRoutes from "./tasks.js";
import labelRoutes from "./labels.js";
import projectRoutes from "./projects.js";
import sectionRoutes from "./sections.js";
import viewRoutes from "./views.js";
import filterRoutes from "./filters.js";
import searchRoutes from "./search.js";
import reminderRoutes, { taskReminderRouter } from "./reminders.js";
import commentRoutes, { taskCommentRouter } from "./comments.js";
import preferencesRoutes from "./preferences.js";
import habitRoutes from "./habits.js";
import habitGroupRoutes from "./habitGroups.js";
import activityRoutes from "./activity.js";
import collaborationRoutes, { projectCollabRouter } from "./collaboration.js";

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
router.use("/reminders", reminderRoutes);
router.use("/tasks/:taskId/reminders", taskReminderRouter);
router.use("/comments", commentRoutes);
router.use("/tasks/:taskId/comments", taskCommentRouter);
router.use("/preferences", preferencesRoutes);
router.use("/habits", habitRoutes);
router.use("/habit-groups", habitGroupRoutes);
router.use("/activity", activityRoutes);
router.use("/", collaborationRoutes);
router.use("/projects/:id", projectCollabRouter);
router.use("/", sectionRoutes);

export default router;
