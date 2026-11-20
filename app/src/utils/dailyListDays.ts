import type { DaySection, ListDays, ListDaysInput } from '../types/daily';
import { addDaysISO, dateFromISO, dayLabel } from './dailySections';

function daysBetween(first: string, last: string, input: ListDaysInput): DaySection[] {
  const days: DaySection[] = [];
  for (let key = first; key <= last; key = addDaysISO(key, 1)) {
    const section = input.sections.find((s) => s.key === key)
      ?? { key, label: dayLabel(dateFromISO(key), input.locale, input.dateFormat), tasks: [] };
    if (!input.hideEmptyDays || section.tasks.length > 0) days.push(section);
  }
  return days;
}

/** Splits the List's range around today so each day can take a task, even when empty. */
export function listDays(input: ListDaysInput): ListDays {
  const { from, to, todayKey, preview } = input;
  if (todayKey < from || todayKey > to) {
    return { past: [], future: [], browsed: daysBetween(from, to, input) };
  }
  return {
    past: preview ? [] : daysBetween(from, addDaysISO(todayKey, -1), { ...input, hideEmptyDays: false }),
    future: daysBetween(addDaysISO(todayKey, 1), to, input),
    browsed: null,
  };
}
