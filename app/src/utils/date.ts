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

export type WeekStart = 'sunday' | 'monday';

const SUNDAY_FIRST_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONDAY_FIRST_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const SUNDAY_FIRST_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONDAY_FIRST_SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function weekdayInitials(weekStart: WeekStart): readonly string[] {
  return weekStart === 'monday' ? MONDAY_FIRST_INITIALS : SUNDAY_FIRST_INITIALS;
}

export function weekdayShortNames(weekStart: WeekStart): readonly string[] {
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

export function parseNaturalDate(input: string): ParsedDate | null {
  const today = new Date();
  const lower = input.toLowerCase();

  const patterns: Array<{ 
    re: RegExp; 
    resolve: (m: RegExpMatchArray) => Date | null; 
    recurrence?: object | ((m: RegExpMatchArray) => object); 
    label: string 
  }> = [
    {
      re: /\bevery day\b/,
      resolve: () => today,
      recurrence: { type: 'daily', interval: 1 },
      label: 'Every day',
    },
    {
      re: /\bevery week\b/,
      resolve: () => today,
      recurrence: { type: 'weekly', interval: 1 },
      label: 'Every week',
    },
    {
      re: /\bevery month\b/,
      resolve: () => today,
      recurrence: { type: 'monthly', interval: 1 },
      label: 'Every month',
    },
    {
      re: /\bevery (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      resolve: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const target = days.indexOf(m[1]);
        const d = new Date(today);
        const diff = (target + 7 - d.getDay()) % 7;
        d.setDate(d.getDate() + (diff === 0 ? 0 : diff));
        return d;
      },
      recurrence: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return { type: 'weekly', interval: 1, weekdays: [days.indexOf(m[1])] };
      },
      label: 'Every week',
    },
    {
      re: /\btoday\b/,
      resolve: () => today,
      label: 'Today',
    },
    {
      re: /\btomorrow\b/,
      resolve: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
      },
      label: 'Tomorrow',
    },
    {
      re: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      resolve: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const target = days.indexOf(m[1]);
        const d = new Date(today);
        d.setDate(d.getDate() + ((target + 7 - d.getDay()) % 7 || 7));
        return d;
      },
      label: 'Next',
    },
    {
      re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      resolve: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const target = days.indexOf(m[1]);
        const d = new Date(today);
        const diff = (target + 7 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d;
      },
      label: '',
    },
    {
      re: /\bin (\d+) days?\b/,
      resolve: (m) => {
        const d = new Date(today);
        d.setDate(d.getDate() + parseInt(m[1]));
        return d;
      },
      label: '',
    },
    {
      re: /\bnext week\b/,
      resolve: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        return d;
      },
      label: 'Next week',
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
          preview: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (recRule ? ' (Recurring)' : ''),
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
  fallbackDueDate?: string
): { title: string; dueDate?: string; recurrenceRule?: object | null } {
  const parsed = parseNaturalDate(input);
  if (!parsed) {
    return { title: input, dueDate: fallbackDueDate };
  }
  const stripped = input.replace(new RegExp(`\\b${parsed.text}\\b`, 'i'), '').replace(/\s+/g, ' ').trim();
  return {
    title: stripped || input,
    dueDate: parsed.isoDate,
    recurrenceRule: parsed.recurrenceRule,
  };
}
