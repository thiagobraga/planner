export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // 1-999
  weekdays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  month?: number; // 1-12 (for yearly)
}

export interface DueDate {
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h)
  timezone?: string; // IANA timezone
  recurrence?: RecurrenceRule;
}

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function addDays(year: number, month: number, day: number, n: number): { year: number; month: number; day: number } {
  const d = new Date(year, month - 1, day + n);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

function computeDaily(current: { year: number; month: number; day: number }, interval: number): { year: number; month: number; day: number } {
  return addDays(current.year, current.month, current.day, interval);
}

function computeWeekly(
  current: { year: number; month: number; day: number },
  interval: number,
  weekdays?: number[]
): { year: number; month: number; day: number } {
  if (!weekdays || weekdays.length === 0) {
    // No weekdays specified: advance by N weeks
    return addDays(current.year, current.month, current.day, 7 * interval);
  }

  const sortedDays = [...weekdays].sort((a, b) => a - b);
  const currentDow = getDayOfWeek(current.year, current.month, current.day);

  // Find next matching weekday in current week (strictly after current day)
  for (const wd of sortedDays) {
    if (wd > currentDow) {
      const daysAhead = wd - currentDow;
      return addDays(current.year, current.month, current.day, daysAhead);
    }
  }

  // No matching day later this week; jump to first matching day in next interval week
  const daysUntilEndOfWeek = 7 - currentDow;
  const daysToSkip = daysUntilEndOfWeek + 7 * (interval - 1) + sortedDays[0];
  return addDays(current.year, current.month, current.day, daysToSkip);
}

function computeMonthly(
  current: { year: number; month: number; day: number },
  interval: number,
  dayOfMonth?: number
): { year: number; month: number; day: number } {
  const targetDay = dayOfMonth ?? current.day;

  let newMonth = current.month + interval;
  let newYear = current.year;

  while (newMonth > 12) {
    newMonth -= 12;
    newYear++;
  }

  const maxDay = daysInMonth(newYear, newMonth);
  const clampedDay = Math.min(targetDay, maxDay);

  return { year: newYear, month: newMonth, day: clampedDay };
}

function computeYearly(
  current: { year: number; month: number; day: number },
  interval: number,
  month?: number,
  dayOfMonth?: number
): { year: number; month: number; day: number } {
  const targetMonth = month ?? current.month;
  const targetDay = dayOfMonth ?? current.day;
  const newYear = current.year + interval;

  const maxDay = daysInMonth(newYear, targetMonth);
  const clampedDay = Math.min(targetDay, maxDay);

  return { year: newYear, month: targetMonth, day: clampedDay };
}

export function computeNextOccurrence(currentDueDate: DueDate, rule: RecurrenceRule): DueDate {
  const current = parseDate(currentDueDate.date);
  let next: { year: number; month: number; day: number };

  switch (rule.type) {
    case 'daily':
      next = computeDaily(current, rule.interval);
      break;
    case 'weekly':
      next = computeWeekly(current, rule.interval, rule.weekdays);
      break;
    case 'monthly':
      next = computeMonthly(current, rule.interval, rule.dayOfMonth);
      break;
    case 'yearly':
      next = computeYearly(current, rule.interval, rule.month, rule.dayOfMonth);
      break;
  }

  return {
    date: formatDate(next.year, next.month, next.day),
    ...(currentDueDate.time !== undefined && { time: currentDueDate.time }),
    ...(currentDueDate.timezone !== undefined && { timezone: currentDueDate.timezone }),
    recurrence: rule,
  };
}
