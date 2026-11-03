import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { securityLog } from "../utils/securityLogger.js";
import { revokeAllUserSessions } from "./sessionService.js";
import { revokeAllUserTokens } from "./apiTokenService.js";
import { revokeAllUserGrants } from "./oauthService.js";
import type {
  AccountCollectionRow,
  AccountCommentRow,
  AccountExportData,
  AccountFilterRow,
  AccountHabitCompletionRow,
  AccountHabitRow,
  AccountLabelRow,
  AccountPreferencesRow,
  AccountReminderRow,
  AccountSectionRow,
  AccountTaskRow,
  AccountUserRow,
} from "../types/account.js";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toNullableIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function exportUserData(userId: string): Promise<AccountExportData> {
  const userResult = await pool.query(
    `SELECT email, display_name, created_at
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (userResult.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "User not found",
      statusCode: 404,
    });
  }

  const userRow = userResult.rows[0] as AccountUserRow;

  const [
    preferencesResult,
    collectionsResult,
    tasksResult,
    labelsResult,
    sectionsResult,
    habitsResult,
    habitCompletionsResult,
    filtersResult,
    commentsResult,
    remindersResult,
  ] = await Promise.all([
    pool.query(
      `SELECT time_zone, week_start, theme, notifications_enabled, font, show_dots,
              background, small_caps, hide_completed_tasks, show_notes, show_checkboxes,
              agent_change_notices, locale, date_format
       FROM preferences
       WHERE user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT id, parent_id, name, color, is_inbox, is_archived, order_value, created_at, updated_at
       FROM collections
       WHERE user_id = $1
       ORDER BY order_value ASC, created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, collection_id, section_id, parent_task_id, title, description, priority,
              due_date, due_time, due_timezone, deadline_date, deadline_time, deadline_timezone,
              duration_minutes, recurrence_rule, is_completed, completed_at, order_value,
              depth, type, status_id, created_at, updated_at
       FROM tasks
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, name, color, created_at, updated_at
       FROM labels
       WHERE user_id = $1
       ORDER BY name ASC`,
      [userId],
    ),
    pool.query(
      `SELECT s.id, s.collection_id, s.name, s.order_value, s.created_at, s.updated_at
       FROM sections s
       JOIN collections c ON c.id = s.collection_id
       WHERE c.user_id = $1
       ORDER BY s.order_value ASC, s.created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, name, order_value, parent_id, group_id, archived_at, created_at, updated_at
       FROM habits
       WHERE user_id = $1
       ORDER BY order_value ASC, created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT hc.habit_id, hc.completed_date, hc.created_at
       FROM habit_completions hc
       JOIN habits h ON h.id = hc.habit_id
       WHERE h.user_id = $1
       ORDER BY hc.completed_date ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, name, query, created_at, updated_at
       FROM filters
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, task_id, body, created_at, updated_at
       FROM comments
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, task_id, remind_at, is_fired, created_at
       FROM reminders
       WHERE user_id = $1
       ORDER BY remind_at ASC`,
      [userId],
    ),
  ]);

  const prefRow = preferencesResult.rows[0] as AccountPreferencesRow | undefined;

  return {
    user: {
      email: userRow.email,
      displayName: userRow.display_name,
      createdAt: toIso(userRow.created_at),
    },
    preferences: prefRow
      ? {
          timeZone: prefRow.time_zone,
          weekStart: prefRow.week_start,
          theme: prefRow.theme,
          notificationsEnabled: prefRow.notifications_enabled,
          font: prefRow.font,
          showDots: prefRow.show_dots,
          background: prefRow.background,
          smallCaps: prefRow.small_caps,
          hideCompletedTasks: prefRow.hide_completed_tasks,
          showNotes: prefRow.show_notes,
          showCheckboxes: prefRow.show_checkboxes,
          agentChangeNotices: prefRow.agent_change_notices,
          locale: prefRow.locale,
          dateFormat: prefRow.date_format ?? "MMM DD ddd",
        }
      : null,
    collections: (collectionsResult.rows as AccountCollectionRow[]).map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      color: row.color,
      isInbox: row.is_inbox,
      isArchived: row.is_archived,
      orderValue: row.order_value,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    tasks: (tasksResult.rows as AccountTaskRow[]).map((row) => ({
      id: row.id,
      collectionId: row.collection_id,
      sectionId: row.section_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      dueDate: toDateOnly(row.due_date),
      dueTime: row.due_time,
      dueTimezone: row.due_timezone,
      deadlineDate: toDateOnly(row.deadline_date),
      deadlineTime: row.deadline_time,
      deadlineTimezone: row.deadline_timezone,
      durationMinutes: row.duration_minutes,
      recurrenceRule: row.recurrence_rule,
      isCompleted: row.is_completed,
      completedAt: toNullableIso(row.completed_at),
      orderValue: row.order_value,
      depth: row.depth,
      type: row.type,
      statusId: row.status_id,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    labels: (labelsResult.rows as AccountLabelRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    sections: (sectionsResult.rows as AccountSectionRow[]).map((row) => ({
      id: row.id,
      collectionId: row.collection_id,
      name: row.name,
      orderValue: row.order_value,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    habits: (habitsResult.rows as AccountHabitRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      orderValue: row.order_value,
      parentId: row.parent_id,
      groupId: row.group_id,
      archivedAt: toNullableIso(row.archived_at),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    habitCompletions: (habitCompletionsResult.rows as AccountHabitCompletionRow[]).map((row) => ({
      habitId: row.habit_id,
      completedDate: toDateOnly(row.completed_date) ?? "",
      createdAt: toIso(row.created_at),
    })),
    filters: (filtersResult.rows as AccountFilterRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      query: row.query,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    comments: (commentsResult.rows as AccountCommentRow[]).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      body: row.body,
      createdAt: toIso(row.created_at),
      updatedAt: toNullableIso(row.updated_at),
    })),
    reminders: (remindersResult.rows as AccountReminderRow[]).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      remindAt: toIso(row.remind_at),
      isFired: row.is_fired,
      createdAt: toIso(row.created_at),
    })),
  };
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await revokeAllUserSessions(userId, "account-deleted");
  await revokeAllUserTokens(userId, "account-deleted");
  await revokeAllUserGrants(userId, "account-deleted");

  const deleted = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [userId],
  );

  if (deleted.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "User not found",
      statusCode: 404,
    });
  }

  securityLog.sessionRevoked(userId, "account-deleted", userId);
}
