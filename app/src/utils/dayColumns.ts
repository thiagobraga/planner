import { buildWeekDays, type WeekStart } from './date';

export type DayColumnId = 'migrate' | `day:${string}`;

export interface DayColumn {
  id: DayColumnId;
  /** ISO YYYY-MM-DD for a day column, null for Migrate. */
  iso: string | null;
  /** Native Date.getDay() (0 = Sunday), only set for day columns. */
  weekday: number | null;
  droppable: boolean;
}

/**
 * The 7 days of the anchor's week, then Migrate (overdue + undated tasks,
 * Bullet-Journal style).
 */
export function buildDayColumns(anchor: Date, today: Date, weekStart: WeekStart): DayColumn[] {
  const days = buildWeekDays(anchor, today, weekStart);
  return [
    ...days.map((day) => ({
      id: `day:${day.iso}` as DayColumnId,
      iso: day.iso,
      weekday: day.weekday,
      droppable: true,
    })),
    { id: 'migrate', iso: null, weekday: null, droppable: true },
  ];
}

/** Which column a task belongs in, given the week currently shown. */
export function slotTaskIntoColumn(task: { dueDate?: string | null }, todayKey: string): DayColumnId {
  if (!task.dueDate) return 'migrate';
  if (task.dueDate < todayKey) return 'migrate';
  return `day:${task.dueDate}`;
}
