import pool from "../db/pool.js";
import type { DailyTaskRow } from "../types/daily.js";
import { AppError } from "../utils/AppError.js";
import { formatTimeFields } from "../utils/taskTime.js";
import { localDateInTimezone } from "./viewService.js";

function dateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validationError(field: string, message: string): AppError {
  return new AppError({ code: "VALIDATION_ERROR", message: "Validation failed", statusCode: 400, details: [{ field, message }] });
}

export async function getDailyRange(userId: string, from: string, to: string, now: Date = new Date()) {
  if (!validDate(from)) throw validationError("from", "from must be a valid ISO date");
  if (!validDate(to)) throw validationError("to", "to must be a valid ISO date");
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  const dayCount = Math.round((end - start) / 86_400_000) + 1;
  if (dayCount < 1 || dayCount > 42) throw validationError("to", "range must contain between 1 and 42 days");

  const preferences = await pool.query(
    "SELECT time_zone, hide_completed_tasks, show_notes FROM preferences WHERE user_id = $1",
    [userId],
  );
  const settings = preferences.rows[0] as
    | { time_zone: string; hide_completed_tasks: boolean; show_notes: boolean }
    | undefined;
  const today = localDateInTimezone(now, settings?.time_zone ?? "UTC");

  const result = await pool.query(
    `SELECT t.id, t.user_id, t.collection_id, t.section_id, t.parent_task_id,
            t.assignee_user_id, t.title, t.description, t.priority, t.due_date,
            t.due_time, t.due_timezone, t.deadline_date, t.deadline_time,
            t.deadline_timezone, t.duration_minutes, t.recurrence_rule,
            t.is_completed, t.completed_at, t.depth, t.type, t.status_id,
            t.created_at, t.updated_at,
            COALESCE(o.position, t.order_value) AS effective_order_value
     FROM tasks t
     JOIN collections c ON c.id = t.collection_id
     LEFT JOIN task_order o ON o.task_id = t.id
       AND o.user_id = $1 AND o.scope_type = 'day'
       AND o.scope_id = to_char(t.due_date, 'YYYY-MM-DD')
     WHERE t.user_id = $1 AND t.due_date IS NOT NULL
       AND (t.due_date < $2::date OR t.due_date BETWEEN $3::date AND $4::date)
       AND c.is_archived = false
       AND ($5::boolean = false OR t.is_completed = false)
       AND ($6::boolean = true OR t.type <> 'note')
     ORDER BY t.due_date ASC, o.position ASC NULLS LAST,
              t.order_value ASC, t.created_at ASC`,
    [userId, today, from, to, settings?.hide_completed_tasks ?? false, settings?.show_notes ?? true],
  );

  const days = Array.from({ length: dayCount }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    tasks: [] as ReturnType<typeof formatTask>[],
  }));
  const dayMap = new Map(days.map((day) => [day.date, day.tasks]));
  const overdue: ReturnType<typeof formatTask>[] = [];
  for (const row of result.rows as DailyTaskRow[]) {
    const dueDate = dateValue(row.due_date);
    const task = formatTask(row);
    if (dueDate < today) overdue.push(task);
    else dayMap.get(dueDate)?.push(task);
  }
  return { from, to, today, overdue, days };
}

function formatTask(row: DailyTaskRow) {
  return {
    id: row.id, userId: row.user_id, collectionId: row.collection_id,
    sectionId: row.section_id, parentTaskId: row.parent_task_id,
    assigneeUserId: row.assignee_user_id, title: row.title,
    description: row.description, priority: row.priority, dueDate: row.due_date,
    ...formatTimeFields(row), dueTimezone: row.due_timezone,
    recurrenceRule: row.recurrence_rule, isCompleted: row.is_completed,
    completedAt: row.completed_at, orderValue: Number(row.effective_order_value),
    depth: row.depth, type: row.type, statusId: row.status_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
