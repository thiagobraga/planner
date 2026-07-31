// Local-time ISO date (YYYY-MM-DD). Deliberately not toISOString(), which would
// shift the date across the UTC boundary for anyone west of Greenwich.
export function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDetectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function fmtISOInTimeZone(d: Date = new Date(), timeZone?: string): string {
  const tz = timeZone || getDetectedTimeZone();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${day}`;
  } catch {
    return fmtISO(d);
  }
}

export function getTimeZoneOffsetMs(d: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      fractionalSecondDigits: 3,
      hourCycle: 'h23',
    }).formatToParts(d);

    let y = 0, m = 0, day = 0, h = 0, min = 0, s = 0, ms = 0;
    for (const p of parts) {
      if (p.type === 'year') y = parseInt(p.value, 10);
      else if (p.type === 'month') m = parseInt(p.value, 10);
      else if (p.type === 'day') day = parseInt(p.value, 10);
      else if (p.type === 'hour') h = parseInt(p.value, 10);
      else if (p.type === 'minute') min = parseInt(p.value, 10);
      else if (p.type === 'second') s = parseInt(p.value, 10);
      else if (p.type === 'fractionalSecond') ms = parseInt(p.value.padEnd(3, '0').slice(0, 3), 10);
    }
    const localUtcAsMs = Date.UTC(y, m - 1, day, h, min, s, ms);
    return localUtcAsMs - d.getTime();
  } catch {
    return -d.getTimezoneOffset() * 60 * 1000;
  }
}

export function getMsUntilMidnight(now: Date = new Date(), timeZone?: string): number {
  const tz = timeZone || getDetectedTimeZone();
  const todayISO = fmtISOInTimeZone(now, tz);
  const [y, m, d] = todayISO.split('-').map(Number);

  const nextDayUtcEstimate = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0);
  const offset = getTimeZoneOffsetMs(new Date(nextDayUtcEstimate), tz);
  let midnightTimestamp = nextDayUtcEstimate - offset;

  const offset2 = getTimeZoneOffsetMs(new Date(midnightTimestamp), tz);
  if (offset2 !== offset) {
    midnightTimestamp = nextDayUtcEstimate - offset2;
  }

  const ms = midnightTimestamp - now.getTime();
  return Math.max(0, ms);
}


export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type WeekStart = 'sunday' | 'monday';

const SUNDAY_FIRST_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONDAY_FIRST_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const SUNDAY_FIRST_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONDAY_FIRST_SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const SUNDAY_FIRST_PT_BR_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
const MONDAY_FIRST_PT_BR_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
const SUNDAY_FIRST_PT_BR_SHORT_NAMES = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'] as const;
const MONDAY_FIRST_PT_BR_SHORT_NAMES = ['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.'] as const;

export function weekdayInitials(weekStart: WeekStart, locale: 'en' | 'pt-BR' = 'en'): readonly string[] {
  if (locale === 'pt-BR') {
    return weekStart === 'monday' ? MONDAY_FIRST_PT_BR_INITIALS : SUNDAY_FIRST_PT_BR_INITIALS;
  }
  return weekStart === 'monday' ? MONDAY_FIRST_INITIALS : SUNDAY_FIRST_INITIALS;
}

export function weekdayShortNames(weekStart: WeekStart, locale: 'en' | 'pt-BR' = 'en'): readonly string[] {
  if (locale === 'pt-BR') {
    return weekStart === 'monday' ? MONDAY_FIRST_PT_BR_SHORT_NAMES : SUNDAY_FIRST_PT_BR_SHORT_NAMES;
  }
  return weekStart === 'monday' ? MONDAY_FIRST_SHORT_NAMES : SUNDAY_FIRST_SHORT_NAMES;
}

export function weekdayColumnIndex(dayOfWeek: number, weekStart: WeekStart): number {
  return weekStart === 'monday' ? (dayOfWeek + 6) % 7 : dayOfWeek;
}

export interface MonthDay {
  iso: string;
  dayOfMonth: number;
  /** Zero-based column in the configured weekday order. */
  dow: number;
  future: boolean;
}

export function buildMonthDays(
  year: number,
  month: number,
  today: Date,
  weekStart: WeekStart = 'sunday',
): MonthDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return {
      iso: fmtISO(date),
      dayOfMonth: i + 1,
      dow: weekdayColumnIndex(date.getDay(), weekStart),
      future: date.getTime() > today.getTime(),
    };
  });
}

export interface ParsedDate {
  text: string;
  preview: string;
  isoDate: string;
  recurrenceRule?: object | null;
}

export function parseNaturalDate(input: string, locale: 'en' | 'pt-BR' = 'en'): ParsedDate | null {
  const today = new Date();
  const lower = input.toLocaleLowerCase(locale);
  const englishDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const portugueseDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dayNames = locale === 'pt-BR' ? portugueseDays : englishDays;
  const weekdayPattern = locale === 'pt-BR'
    ? '(domingo|segunda(?:-feira)?|terça(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sábado|sabado)'
    : '(monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
  const weekdayIndex = (value: string) => {
    const normalized = value
      .replace('-feira', '')
      .replace('terca', 'terça')
      .replace('sabado', 'sábado');
    return dayNames.indexOf(normalized);
  };

  const patterns: Array<{
    re: RegExp;
    resolve: (m: RegExpMatchArray) => Date | null;
    recurrence?: object | ((m: RegExpMatchArray) => object);
  }> = [
    {
      re: locale === 'pt-BR' ? /(?:\btodo dia\b|\btodos os dias\b)/u : /\bevery day\b/,
      resolve: () => today,
      recurrence: { type: 'daily', interval: 1 },
    },
    {
      re: locale === 'pt-BR' ? /\btoda semana\b/u : /\bevery week\b/,
      resolve: () => today,
      recurrence: { type: 'weekly', interval: 1 },
    },
    {
      re: locale === 'pt-BR' ? /\btodo (?:mês|mes)\b/u : /\bevery month\b/,
      resolve: () => today,
      recurrence: { type: 'monthly', interval: 1 },
    },
    {
      re: new RegExp(locale === 'pt-BR' ? `\\btod[oa] ${weekdayPattern}` : `\\bevery ${weekdayPattern}`, 'u'),
      resolve: (m) => {
        const target = weekdayIndex(m[1]);
        const d = new Date(today);
        const diff = (target + 7 - d.getDay()) % 7;
        d.setDate(d.getDate() + (diff === 0 ? 0 : diff));
        return d;
      },
      recurrence: (m) => {
        return { type: 'weekly', interval: 1, weekdays: [weekdayIndex(m[1])] };
      },
    },
    {
      re: locale === 'pt-BR' ? /\bhoje\b/u : /\btoday\b/,
      resolve: () => today,
    },
    {
      re: locale === 'pt-BR' ? /\b(?:amanhã|amanha)/u : /\btomorrow\b/,
      resolve: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      re: new RegExp(locale === 'pt-BR' ? `\\bpr[oó]xim[oa] ${weekdayPattern}` : `\\bnext ${weekdayPattern}`, 'u'),
      resolve: (m) => {
        const target = weekdayIndex(m[1]);
        const d = new Date(today);
        d.setDate(d.getDate() + ((target + 7 - d.getDay()) % 7 || 7));
        return d;
      },
    },
    {
      re: new RegExp(`\\b${weekdayPattern}`, 'u'),
      resolve: (m) => {
        const target = weekdayIndex(m[1]);
        const d = new Date(today);
        const diff = (target + 7 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d;
      },
    },
    {
      re: locale === 'pt-BR' ? /\bem (\d+) dias?\b/u : /\bin (\d+) days?\b/,
      resolve: (m) => {
        const d = new Date(today);
        d.setDate(d.getDate() + parseInt(m[1]));
        return d;
      },
    },
    {
      re: locale === 'pt-BR' ? /\bpr[oó]xima semana\b/u : /\bnext week\b/,
      resolve: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        return d;
      },
    },
  ];

  for (const { re, resolve, recurrence } of patterns) {
    const m = lower.match(re);
    if (m) {
      const date = resolve(m);
      if (date) {
        let recRule = undefined;
        if (typeof recurrence === 'function') {
          recRule = recurrence(m);
        } else if (recurrence) {
          recRule = recurrence;
        }
        const isoDate = fmtISO(date);
        return {
          text: m[0],
          preview: new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
            + (recRule ? ` (${locale === 'pt-BR' ? 'Recorrente' : 'Recurring'})` : ''),
          isoDate,
          recurrenceRule: recRule,
        };
      }
    }
  }
  return null;
}

export function extractNaturalDate(
  input: string,
  fallbackDueDate?: string,
  locale: 'en' | 'pt-BR' = 'en',
): { title: string; dueDate?: string; recurrenceRule?: object | null } {
  const parsed = parseNaturalDate(input, locale);
  if (!parsed) {
    return { title: input, dueDate: fallbackDueDate };
  }
  const start = input.toLocaleLowerCase(locale).indexOf(parsed.text.toLocaleLowerCase(locale));
  const stripped = `${input.slice(0, start)} ${input.slice(start + parsed.text.length)}`.replace(/\s+/g, ' ').trim();
  return {
    title: stripped || input,
    dueDate: parsed.isoDate,
    recurrenceRule: parsed.recurrenceRule,
  };
}
