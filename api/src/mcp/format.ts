import type { McpTaskLike } from "../types/mcp.js";

export const MAX_LISTED = 100;

/** node-postgres hands DATE columns back as local-midnight Dates; read them back the same way. */
export function dateKey(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * One line per task, compact enough that a day's worth fits in an agent's
 * context, with the id last so the agent can act on it.
 */
export function formatTaskLine(task: McpTaskLike, collectionNames: Map<string, string>): string {
  const parts = [`- [${task.isCompleted ? "x" : " "}] ${task.title}`];

  if (task.dueDate) parts.push(`due ${dateKey(task.dueDate)}${task.dueTime ? ` ${task.dueTime}` : ""}`);
  if (task.deadlineDate) parts.push(`deadline ${dateKey(task.deadlineDate)}`);
  if (task.recurrenceRule) parts.push("recurring");
  if (task.priority && task.priority < 4) parts.push(`p${task.priority}`);
  if (task.type && task.type !== "task") parts.push(task.type);

  const labels = task.labelNames ?? task.labels?.map((l) => l.name) ?? [];
  for (const label of labels) parts.push(`@${label}`);

  const collection = task.collectionName ?? (task.collectionId ? collectionNames.get(task.collectionId) : undefined);
  if (collection) parts.push(`#${collection}`);

  parts.push(`id:${task.id}`);
  return parts.join(" · ");
}

export function formatTaskList(
  tasks: McpTaskLike[],
  collectionNames: Map<string, string>,
  empty = "No tasks.",
): string {
  if (tasks.length === 0) return empty;
  const lines = tasks.slice(0, MAX_LISTED).map((task) => formatTaskLine(task, collectionNames));
  if (tasks.length > MAX_LISTED) {
    lines.push(`...and ${tasks.length - MAX_LISTED} more. Narrow it down with filter_tasks.`);
  }
  return lines.join("\n");
}
