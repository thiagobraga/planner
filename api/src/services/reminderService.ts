import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface ReminderRow {
  id: string;
  task_id: string;
  user_id: string;
  remind_at: string;
  is_fired: boolean;
  created_at: string;
}

function formatReminder(row: ReminderRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    remindAt: row.remind_at,
    isFired: row.is_fired,
    createdAt: row.created_at,
  };
}

async function verifyTaskAccess(taskId: string, userId: string): Promise<{ collection_id: string }> {
  const result = await pool.query(
    `SELECT t.collection_id FROM tasks t
     WHERE t.id = $1
       AND (t.user_id = $2 OR t.collection_id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [taskId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Task not found",
      statusCode: 404,
    });
  }

  return result.rows[0] as { collection_id: string };
}

export function validateRemindAt(remindAt: unknown, now: Date = new Date()): Date {
  if (typeof remindAt !== "string") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "remindAt", message: "remindAt must be an ISO 8601 datetime string" }],
    });
  }

  const dt = new Date(remindAt);
  if (Number.isNaN(dt.getTime())) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "remindAt", message: "remindAt must be a valid datetime" }],
    });
  }

  if (dt.getTime() <= now.getTime()) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "remindAt", message: "remindAt must be in the future" }],
    });
  }

  return dt;
}

export async function createReminder(
  taskId: string,
  userId: string,
  remindAt: string,
  now: Date = new Date(),
) {
  await verifyTaskAccess(taskId, userId);
  const dt = validateRemindAt(remindAt, now);

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO reminders (id, task_id, user_id, remind_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, taskId, userId, dt.toISOString()],
  );

  return formatReminder(result.rows[0] as ReminderRow);
}

export async function listRemindersForTask(taskId: string, userId: string) {
  await verifyTaskAccess(taskId, userId);

  const result = await pool.query(
    `SELECT * FROM reminders WHERE task_id = $1 ORDER BY remind_at ASC`,
    [taskId],
  );

  return result.rows.map((r) => formatReminder(r as ReminderRow));
}

export async function deleteReminder(reminderId: string, userId: string): Promise<{ success: true }> {
  const result = await pool.query(
    `DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id`,
    [reminderId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Reminder not found",
      statusCode: 404,
    });
  }

  return { success: true };
}

// Called by task service when due_date with time is set; idempotent
export async function autoScheduleForTaskDue(
  taskId: string,
  userId: string,
  dueDateIso: string,
): Promise<void> {
  // Cancel existing auto-scheduled (not yet fired) reminders for this task
  await pool.query(
    `DELETE FROM reminders WHERE task_id = $1 AND is_fired = false`,
    [taskId],
  );

  const dt = new Date(dueDateIso);
  if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
    return;
  }

  await pool.query(
    `INSERT INTO reminders (id, task_id, user_id, remind_at)
     VALUES ($1, $2, $3, $4)`,
    [uuidv4(), taskId, userId, dt.toISOString()],
  );
}

// Used by a scheduler job that polls every minute and fans out notifications.
export async function fetchDueReminders(now: Date = new Date(), windowSeconds = 60) {
  const upper = new Date(now.getTime() + windowSeconds * 1000);

  const result = await pool.query(
    `SELECT r.*, p.notifications_enabled
     FROM reminders r
     JOIN preferences p ON p.user_id = r.user_id
     WHERE r.is_fired = false
       AND r.remind_at <= $1
     ORDER BY r.remind_at ASC`,
    [upper.toISOString()],
  );

  return result.rows
    .filter((r: { notifications_enabled: boolean }) => r.notifications_enabled)
    .map((r) => formatReminder(r as ReminderRow));
}

export async function markReminderFired(reminderId: string): Promise<void> {
  await pool.query(
    `UPDATE reminders SET is_fired = true WHERE id = $1`,
    [reminderId],
  );
}
