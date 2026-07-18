// Local-time ISO date (YYYY-MM-DD). Deliberately not toISOString(), which would
// shift the date across the UTC boundary for anyone west of Greenwich.
export function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export interface MonthDay {
  iso: string;
  dayOfMonth: number;
  /** Monday=0 … Sunday=6, matching the M T W T F S S column order. */
  dow: number;
  future: boolean;
}

export function buildMonthDays(year: number, month: number, today: Date): MonthDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return {
      iso: fmtISO(date),
      dayOfMonth: i + 1,
      dow: (date.getDay() + 6) % 7,
      future: date.getTime() > today.getTime(),
    };
  });
}
