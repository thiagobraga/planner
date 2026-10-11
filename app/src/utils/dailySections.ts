import type { ApiTask } from '../api/client';
import type { Task } from '../components/TaskItem';
import type { ApiDailyView, DaySection } from '../types/daily';
import { fmtISO, fmtISOInTimeZone } from './date';
import { scheduleFieldsFromApi } from './taskTime';

export function dayLabel(d: Date, locale: 'en' | 'pt-BR', format: string = 'MMM DD ddd'): string {
  const clean = locale === 'pt-BR' ? (val: string) => val.replace(/\./g, '') : (val: string) => val;
  const month = clean(d.toLocaleDateString(locale, { month: 'short' })).toLocaleUpperCase(locale);
  const day = String(d.getDate()).padStart(2, '0');
  const weekday = clean(d.toLocaleDateString(locale, { weekday: 'short' })).toLocaleUpperCase(locale);
  const year = d.getFullYear();

  switch (format) {
    case 'DD/MM ddd':
      return `${day}/${String(d.getMonth() + 1).padStart(2, '0')} ${weekday}`;
    case 'DD-MM-YYYY ddd':
      return `${day}-${String(d.getMonth() + 1).padStart(2, '0')}-${year} ${weekday}`;
    case 'ddd MMM DD':
      return `${weekday} ${month} ${day}`;
    case 'YYYY-MM-DD':
      return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`;
    case 'MMM DD ddd':
    default:
      return `${month} ${day} ${weekday}`;
  }
}

export function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    labels: t.labels,
    indent: t.depth,
    collectionId: t.collectionId,
    sectionId: t.sectionId,
    parentTaskId: t.parentTaskId ?? undefined,
    dueDate: t.dueDate ? t.dueDate.slice(0, 10) : undefined,
    ...scheduleFieldsFromApi(t),
    type: t.type,
    createdAt: t.createdAt,
  };
}

/** Overdue plus every requested day as one list; a past day of the range is in both, so each task counts once. */
export function flattenDaily(view: ApiDailyView): ApiTask[] {
  const seen = new Set<string>();
  const tasks: ApiTask[] = [];
  for (const task of [...view.overdue, ...view.days.flatMap((day) => day.tasks)]) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

/** One section per due date, newest first. Today always exists, so there is somewhere to add a task. */
export function buildSections(
  tasks: Task[],
  locale: 'en' | 'pt-BR',
  currentTodayKey: string = fmtISOInTimeZone(new Date()),
  dateFormat: string = 'MMM DD ddd',
): DaySection[] {
  const byDate = new Map<string, Task[]>();

  for (const t of tasks) {
    // Trim any timestamp portion before matching. Falling back to todayKey is a
    // last resort for a genuinely undated task, not something a full ISO
    // timestamp should ever trigger - that would drag unrelated rows into today.
    const date = t.dueDate?.slice(0, 10);
    const key = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : currentTodayKey;
    const bucket = byDate.get(key) ?? [];
    bucket.push(t);
    byDate.set(key, bucket);
  }

  if (!byDate.has(currentTodayKey)) byDate.set(currentTodayKey, []);

  return Array.from(byDate.keys())
    .sort()
    .reverse()
    .map((date) => ({
      key: date,
      label: dayLabel(dateFromISO(date), locale, dateFormat),
      tasks: (byDate.get(date) ?? []).sort((a, b) => a.orderValue - b.orderValue || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    }));
}

export function addDaysISO(iso: string, days: number): string {
  const d = dateFromISO(iso);
  d.setDate(d.getDate() + days);
  return fmtISO(d);
}
