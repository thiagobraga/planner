import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { listSections } from "./sectionService.js";
import { attachLabels } from "./labelService.js";
import type { Status } from "./statusService.js";
import { formatTimeFields } from "../utils/taskTime.js";
import type { TaskTimeRow } from "../types/task.js";

export interface TaskRow extends TaskTimeRow {
  id: string;
  user_id: string;
  collection_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  assignee_user_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | Date | null;
  due_timezone: string | null;
  recurrence_rule: object | null;
  is_completed: boolean;
  completed_at: string | null;
  order_value: number;
  effective_order_value?: number;
  depth: number;
  type: string;
  status_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PreferencesRow {
  time_zone: string;
  hide_completed_tasks: boolean;
  show_notes: boolean;
}

interface StatusRow {
  id: string;
  collection_id: string;
  name: string;
  color: string;
  completion_status_id: string | null;
  order_value: number;
  created_at: string;
  updated_at: string;
}

interface BoardOrderRow {
  task_id: string;
  scope_type: "status" | "priority";
  position: number;
}

export function formatTask(row: TaskRow) {
  return {
    id: row.id,
    userId: row.user_id,
    collectionId: row.collection_id,
    sectionId: row.section_id,
    parentTaskId: row.parent_task_id,
    assigneeUserId: row.assignee_user_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    ...formatTimeFields(row),
    dueTimezone: row.due_timezone,
    recurrenceRule: row.recurrence_rule,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    orderValue: Number(row.effective_order_value ?? row.order_value),
    depth: row.depth,
    type: row.type,
    statusId: row.status_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getBoardMetadata(collectionId: string, userId: string) {
  const statusesResult = await pool.query(
    `SELECT s.*, c.completion_status_id
     FROM task_statuses s
     INNER JOIN collections c ON c.id = s.collection_id
     WHERE s.collection_id = $1
     ORDER BY s.order_value ASC`,
    [collectionId],
  );
  const orderResult = await pool.query(
    `SELECT o.task_id, o.scope_type, o.position
     FROM task_order o
     INNER JOIN tasks t ON t.id = o.task_id
     WHERE t.collection_id = $1
       AND o.user_id = $2
       AND o.scope_type IN ('status', 'priority')`,
    [collectionId, userId],
  );

  const boardOrder: { status: Record<string, number>; priority: Record<string, number> } = {
    status: {},
    priority: {},
  };
  for (const row of orderResult.rows as BoardOrderRow[]) {
    boardOrder[row.scope_type][row.task_id] = Number(row.position);
  }

  const statuses: Status[] = (statusesResult.rows as StatusRow[]).map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    color: row.color,
    orderValue: row.order_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const completionStatusId = (statusesResult.rows[0] as StatusRow | undefined)?.completion_status_id ?? null;
  return { statuses, completionStatusId, boardOrder };
}

export async function getUserTimezone(userId: string): Promise<string> {
  const result = await pool.query(
    `SELECT time_zone FROM preferences WHERE user_id = $1`,
    [userId],
  );
  return (result.rows[0]?.time_zone as string) ?? "UTC";
}

export async function getViewPreferences(userId: string, now: Date = new Date()) {
  const result = await pool.query(
    `SELECT time_zone, hide_completed_tasks, show_notes
     FROM preferences
     WHERE user_id = $1`,
    [userId],
  );

  const row = result.rows[0] as PreferencesRow | undefined;
  const timeZone = row?.time_zone ?? "UTC";
  return {
    timeZone,
    hideCompletedTasks: row?.hide_completed_tasks ?? false,
    showNotes: row?.show_notes ?? true,
    todayDate: localDateInTimezone(now, timeZone),
  };
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

export async function getInboxView(userId: string, now: Date = new Date()) {
  const settings = await getViewPreferences(userId, now);
  const inboxResult = await pool.query(
    `SELECT id FROM collections WHERE user_id = $1 AND is_inbox = true`,
    [userId],
  );
  const inboxCollection = inboxResult.rows[0] as { id: string } | undefined;

  const result = await pool.query(
    `SELECT t.* FROM tasks t
     JOIN collections p ON p.id = t.collection_id
     WHERE t.user_id = $1
       AND p.is_inbox = true
       AND p.is_archived = false
       AND ($2::boolean = false OR t.is_completed = false)
       AND ($3::boolean = true OR NOT (t.type = 'note'))
     ORDER BY t.order_value ASC, t.created_at ASC`,
    [userId, settings.hideCompletedTasks, settings.showNotes],
  );

  const sections = inboxCollection ? await listSections(inboxCollection.id, userId) : [];
  const tasks = await attachLabels((result.rows as TaskRow[]).map(formatTask));
  const boardMetadata = inboxCollection
    ? await getBoardMetadata(inboxCollection.id, userId)
    : { statuses: [], completionStatusId: null, boardOrder: { status: {}, priority: {} } };

  return {
    tasks,
    collectionId: null,
    inboxCollectionId: inboxCollection?.id,
    sections,
    ...boardMetadata,
  };
}

export async function getCollectionView(userId: string, collectionId: string, now: Date = new Date()) {
  const settings = await getViewPreferences(userId, now);
  const collectionResult = await pool.query(
    `SELECT id, name, color, is_inbox FROM collections
     WHERE id = $1
     AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [collectionId, userId],
  );

  const collection = collectionResult.rows[0] as
    | { id: string; name: string; color: string; is_inbox: boolean }
    | undefined;
  if (!collection) {
    throw new AppError({ code: "NOT_FOUND", message: "Collection not found", statusCode: 404 });
  }

  const result = await pool.query(
    `SELECT * FROM tasks
     WHERE collection_id = $1
       AND ($2::boolean = false OR is_completed = false)
       AND ($3::boolean = true OR NOT (type = 'note'))
     ORDER BY order_value ASC, created_at ASC`,
    [collectionId, settings.hideCompletedTasks, settings.showNotes],
  );

  const sections = await listSections(collectionId, userId);
  const tasks = await attachLabels((result.rows as TaskRow[]).map(formatTask));
  const boardMetadata = await getBoardMetadata(collectionId, userId);

  return {
    collection: {
      id: collection.id,
      name: collection.name,
      color: collection.color,
      isInbox: collection.is_inbox,
    },
    tasks,
    collectionId,
    sections,
    ...boardMetadata,
  };
}
