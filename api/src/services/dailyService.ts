import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import type { DailyView } from "../types/daily.js";
import { addDaysISO, formatTask, getViewPreferences, type TaskRow } from "./viewService.js";

/** Covers the month grid: six weeks. */
export const MAX_DAILY_RANGE_DAYS = 42;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validationError(field: string, message: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    statusCode: 400,
    details: [{ field, message }],
  });
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateRange(from: string, to: string): number {
  if (!isRealDate(from)) throw validationError("from", "from must be a real date in YYYY-MM-DD format");
  if (!isRealDate(to)) throw validationError("to", "to must be a real date in YYYY-MM-DD format");
  if (from > to) throw validationError("to", "to must not be before from");

  const length = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (length > MAX_DAILY_RANGE_DAYS) {
    throw validationError("to", `range must not exceed ${MAX_DAILY_RANGE_DAYS} days`);
  }
  return length;
}

export async function getDailyView(userId: string, from: string, to: string, now: Date = new Date()): Promise<DailyView> {
  const length = validateRange(from, to);
  const settings = await getViewPreferences(userId, now);

  // Daily is hand-sorted per day, and those positions live in `task_order`
  // rather than `tasks.order_value` - a task holds a place in its collection and
  // a separate place in its day, and one column cannot express both. Tasks never
  // dragged within Daily hold no day position and fall back to collection order.
  const result = await pool.query(
    `SELECT t.id, t.user_id, t.collection_id, t.section_id, t.parent_task_id, t.assignee_user_id, t.title, t.description, t.priority, t.due_date, t.due_time, t.due_timezone, t.deadline_date, t.deadline_time, t.deadline_timezone, t.duration_minutes, t.recurrence_rule, t.is_completed, t.completed_at, t.depth, t.type, t.status_id, t.created_at, t.updated_at, COALESCE(o.position, t.order_value) AS effective_order_value FROM tasks t
     JOIN collections p ON p.id = t.collection_id
     LEFT JOIN task_order o
       ON o.task_id = t.id
      AND o.scope_type = 'day'
      AND o.scope_id = to_char(t.due_date, 'YYYY-MM-DD')
     WHERE t.user_id = $1
       AND t.due_date IS NOT NULL
       AND (t.due_date < $2::date OR (t.due_date >= $3::date AND t.due_date <= $4::date))
       AND p.is_archived = false
       AND ($5::boolean = false OR t.is_completed = false)
       AND ($6::boolean = true OR NOT (t.type = 'note'))
     ORDER BY t.due_date ASC, o.position ASC NULLS LAST, t.order_value ASC, t.created_at ASC`,
    [userId, settings.todayDate, from, to, settings.hideCompletedTasks, settings.showNotes],
  );

  const overdue: DailyView["overdue"] = [];
  const byDate = new Map<string, DailyView["overdue"]>();
  for (let i = 0; i < length; i++) byDate.set(addDaysISO(from, i), []);

  for (const row of result.rows as TaskRow[]) {
    const task = formatTask(row);
    // pg hands DATE columns back as JS Dates; the day keys are plain strings.
    const date = task.dueDate instanceof Date ? task.dueDate.toISOString().slice(0, 10) : String(task.dueDate).slice(0, 10);
    if (date < settings.todayDate) overdue.push(task);
    byDate.get(date)?.push(task);
  }

  return {
    from,
    to,
    today: settings.todayDate,
    overdue,
    days: Array.from(byDate, ([date, tasks]) => ({ date, tasks })),
  };
}
