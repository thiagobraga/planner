import { Router, type Router as RouterType } from "express";
import taskRoutes from "./tasks.js";
import labelRoutes from "./labels.js";
import collectionRoutes from "./collections.js";
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
import collaborationRoutes, { collectionCollabRouter } from "./collaboration.js";
import adminUserRoutes from "./adminUsers.js";
import adminStatsRoutes from "./adminStats.js";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";

const router: RouterType = Router();

// /health is mounted in index.ts ahead of authMiddleware; a copy here would be
// unreachable behind it.

// authMiddleware already ran globally in index.ts; adminAuth adds the role check.
router.use("/admin/users", adminAuthMiddleware, adminUserRoutes);
router.use("/admin/stats", adminAuthMiddleware, adminStatsRoutes);

router.use("/tasks", taskRoutes);
router.use("/labels", labelRoutes);
router.use("/collections", collectionRoutes);
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
router.use("/collections/:id", collectionCollabRouter);
router.use("/", sectionRoutes);

export default router;
