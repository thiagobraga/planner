import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface TaskRow {
  id: string;
  user_id: string;
  project_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  assignee_user_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  due_timezone: string | null;
  recurrence_rule: object | null;
  is_completed: boolean;
  completed_at: string | null;
  order_value: number;
  depth: number;
  created_at: string;
  updated_at: string;
}

function formatTask(row: TaskRow) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    sectionId: row.section_id,
    parentTaskId: row.parent_task_id,
    assigneeUserId: row.assignee_user_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    dueTime: row.due_time,
    dueTimezone: row.due_timezone,
    recurrenceRule: row.recurrence_rule,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    orderValue: row.order_value,
    depth: row.depth,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserTimezone(userId: string): Promise<string> {
  const result = await pool.query(
    `SELECT time_zone FROM preferences WHERE user_id = $1`,
    [userId],
  );
  return (result.rows[0]?.time_zone as string) ?? "UTC";
}

export function localDateInTimezone(now: Date, timeZone: string): string {
  // YYYY-MM-DD in the given IANA timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface TodayView {
  overdue: ReturnType<typeof formatTask>[];
  today: ReturnType<typeof formatTask>[];
  date: string;
}

export async function getTodayView(userId: string, now: Date = new Date()): Promise<TodayView> {
  const timeZone = await getUserTimezone(userId);
  const todayDate = localDateInTimezone(now, timeZone);

  const result = await pool.query(
    `SELECT t.* FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.user_id = $1
       AND t.is_completed = false
       AND t.due_date IS NOT NULL
       AND t.due_date <= $2::date
       AND p.is_archived = false
     ORDER BY t.priority ASC, t.order_value ASC`,
    [userId, todayDate],
  );

  const overdue: ReturnType<typeof formatTask>[] = [];
  const today: ReturnType<typeof formatTask>[] = [];

  for (const row of result.rows as TaskRow[]) {
    const t = formatTask(row);
    if (t.dueDate && t.dueDate < todayDate) {
      overdue.push(t);
    } else {
      today.push(t);
    }
  }

  return { overdue, today, date: todayDate };
}

export interface UpcomingView {
  days: { date: string; tasks: ReturnType<typeof formatTask>[] }[];
  start: string;
  end: string;
}

export async function getUpcomingView(userId: string, days: number, now: Date = new Date()): Promise<UpcomingView> {
  if (!Number.isInteger(days) || days < 7 || days > 30) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "days", message: "days must be an integer between 7 and 30" }],
    });
  }

  const timeZone = await getUserTimezone(userId);
  const start = localDateInTimezone(now, timeZone);
  const end = addDaysISO(start, days - 1);

  const result = await pool.query(
    `SELECT t.* FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.user_id = $1
       AND t.is_completed = false
       AND t.due_date IS NOT NULL
       AND t.due_date >= $2::date
       AND t.due_date <= $3::date
       AND p.is_archived = false
     ORDER BY t.due_date ASC, t.priority ASC, t.order_value ASC`,
    [userId, start, end],
  );

  const grouped = new Map<string, ReturnType<typeof formatTask>[]>();
  for (let i = 0; i < days; i++) {
    grouped.set(addDaysISO(start, i), []);
  }

  for (const row of result.rows as TaskRow[]) {
    const t = formatTask(row);
    if (t.dueDate) {
      const bucket = grouped.get(t.dueDate);
      if (bucket) bucket.push(t);
    }
  }

  const daysArray = Array.from(grouped.entries()).map(([date, tasks]) => ({ date, tasks }));
  return { days: daysArray, start, end };
}

export async function getInboxView(userId: string) {
  const inboxResult = await pool.query(
    `SELECT id FROM projects WHERE user_id = $1 AND is_inbox = true`,
    [userId],
  );

  const inboxId = inboxResult.rows[0]?.id as string | undefined;
  if (!inboxId) {
    return { tasks: [], projectId: null };
  }

  const result = await pool.query(
    `SELECT * FROM tasks
     WHERE user_id = $1
       AND project_id = $2
       AND is_completed = false
     ORDER BY order_value ASC`,
    [userId, inboxId],
  );

  return {
    tasks: (result.rows as TaskRow[]).map(formatTask),
    projectId: inboxId,
  };
}

export async function getProjectView(userId: string, projectId: string) {
  const projectResult = await pool.query(
    `SELECT id, name, color, is_inbox FROM projects
     WHERE id = $1
       AND (user_id = $2 OR id IN (SELECT project_id FROM collaborators WHERE user_id = $2))`,
    [projectId, userId],
  );

  const project = projectResult.rows[0] as
    | { id: string; name: string; color: string; is_inbox: boolean }
    | undefined;
  if (!project) {
    throw new AppError({ code: "NOT_FOUND", message: "Project not found", statusCode: 404 });
  }

  const result = await pool.query(
    `SELECT * FROM tasks
     WHERE project_id = $1
       AND is_completed = false
     ORDER BY order_value ASC`,
    [projectId],
  );

  return {
    project: {
      id: project.id,
      name: project.name,
      color: project.color,
      isInbox: project.is_inbox,
    },
    tasks: (result.rows as TaskRow[]).map(formatTask),
    projectId,
  };
}
