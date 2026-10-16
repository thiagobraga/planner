import { fmtISO, startOfDay, type WeekStart } from './date';

export type DateQuickOptionKey = 'today' | 'tomorrow' | 'weekend' | 'nextWeek';

export interface DateQuickOption {
  key: DateQuickOptionKey;
  date: string;
}

function plusDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** The one-tap dates offered above the calendar, resolved against `today`. */
export function dateQuickOptions(today: Date, weekStart: WeekStart): DateQuickOption[] {
  const base = startOfDay(today);
  const dow = base.getDay();
  const startDow = weekStart === 'monday' ? 1 : 0;
  const untilSaturday = (6 - dow + 7) % 7;
  const untilWeekStart = (startDow - dow + 7) % 7 || 7;

  return [
    { key: 'today', date: fmtISO(base) },
    { key: 'tomorrow', date: fmtISO(plusDays(base, 1)) },
    { key: 'weekend', date: fmtISO(plusDays(base, untilSaturday)) },
    { key: 'nextWeek', date: fmtISO(plusDays(base, untilWeekStart)) },
  ];
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const clean = (part: string) => part.replace('.', '');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Qui, 15 out" / "Thu, Oct 15". */
export function formatShortDay(iso: string, locale: 'en' | 'pt-BR'): string {
  const date = parseISODate(iso);
  const weekday = capitalize(clean(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)));
  const month = clean(new Intl.DateTimeFormat(locale, { month: 'short' }).format(date));
  return locale === 'pt-BR' ? `${weekday}, ${date.getDate()} ${month}` : `${weekday}, ${month} ${date.getDate()}`;
}
