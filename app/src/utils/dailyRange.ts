import type { BoardViewMode } from '../types/board';
import type { DailyRange, DailySlug } from '../types/daily';
import { fmtISO, startOfWeek, type WeekStart } from './date';

export const DEFAULT_DAILY_SLUG: DailySlug = 'list';

const SLUG_TO_VIEW: Record<DailySlug, BoardViewMode> = {
  list: 'list',
  kanban: 'kanban-list',
  cards: 'kanban',
  monthly: 'calendar',
};

export function slugToView(slug: string | undefined): BoardViewMode | null {
  return slug && Object.hasOwn(SLUG_TO_VIEW, slug) ? SLUG_TO_VIEW[slug as DailySlug] : null;
}

export function viewToSlug(view: BoardViewMode): DailySlug {
  return (Object.keys(SLUG_TO_VIEW) as DailySlug[]).find((slug) => SLUG_TO_VIEW[slug] === view) ?? DEFAULT_DAILY_SLUG;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** The only difference between Daily views is how many days they ask for. */
export function dailyRange(view: BoardViewMode, anchor: Date, weekStart: WeekStart): DailyRange {
  if (view === 'calendar') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: fmtISO(first), to: fmtISO(last) };
  }
  const start = startOfWeek(anchor, weekStart);
  return { from: fmtISO(view === 'list' ? anchor : start), to: fmtISO(addDays(start, 6)) };
}
