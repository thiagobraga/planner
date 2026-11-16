import { fmtISO } from './date';

export type DayColumnId = 'migrate' | `day:${string}`;

export interface DayColumn {
  id: DayColumnId;
  /** ISO YYYY-MM-DD for a day column, null for Migrate. */
  iso: string | null;
  /** Native Date.getDay() (0 = Sunday), only set for day columns. */
  weekday: number | null;
  droppable: boolean;
}

/** Every day from `from` to `to` (inclusive), then Migrate (overdue + undated tasks, Bullet-Journal style). */
export function buildDayColumns(from: string, to: string): DayColumn[] {
  const columns: DayColumn[] = [];
  const [y, m, d] = from.split('-').map(Number);
  for (const day = new Date(y, m - 1, d); fmtISO(day) <= to; day.setDate(day.getDate() + 1)) {
    const iso = fmtISO(day);
    columns.push({ id: `day:${iso}`, iso, weekday: day.getDay(), droppable: true });
  }
  columns.push({ id: 'migrate', iso: null, weekday: null, droppable: true });
  return columns;
}

/** Which column a task belongs in, given the week currently shown. */
export function slotTaskIntoColumn(task: { dueDate?: string | null }, todayKey: string): DayColumnId {
  if (!task.dueDate) return 'migrate';
  if (task.dueDate < todayKey) return 'migrate';
  return `day:${task.dueDate}`;
}
