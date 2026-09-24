import { describe, expect, it, vi } from 'vitest';
import {
  buildMonthDays,
  weekdayColumnIndex,
  weekdayInitials,
  weekdayShortNames,
  extractNaturalDate,
  parseNaturalDate,
  getDetectedTimeZone,
  fmtISOInTimeZone,
  getTimeZoneOffsetMs,
  getMsUntilMidnight,
} from '../date';

describe('timezone & midnight date helpers', () => {
  it('getDetectedTimeZone returns a valid timezone string', () => {
    const tz = getDetectedTimeZone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  it('fmtISOInTimeZone formats date according to target timezone', () => {
    const d = new Date('2026-07-26T23:30:00Z');
    expect(fmtISOInTimeZone(d, 'UTC')).toBe('2026-07-26');
    expect(fmtISOInTimeZone(d, 'Asia/Tokyo')).toBe('2026-07-27');

    const earlyUTC = new Date('2026-07-26T03:30:00Z');
    expect(fmtISOInTimeZone(earlyUTC, 'America/New_York')).toBe('2026-07-25');
  });

  it('getTimeZoneOffsetMs calculates exact offset for standard timezones', () => {
    const d = new Date('2026-07-26T12:00:00Z');
    expect(getTimeZoneOffsetMs(d, 'UTC')).toBe(0);
    expect(getTimeZoneOffsetMs(d, 'Asia/Tokyo')).toBe(9 * 3600 * 1000);
    expect(getTimeZoneOffsetMs(d, 'America/New_York')).toBe(-4 * 3600 * 1000);
  });

  it('getMsUntilMidnight calculates remaining milliseconds to next midnight', () => {
    const oneMinBeforeUtcMidnight = new Date('2026-07-26T23:59:00.000Z');
    expect(getMsUntilMidnight(oneMinBeforeUtcMidnight, 'UTC')).toBe(60000);

    const oneMinBeforeTokyoMidnight = new Date('2026-07-26T14:59:00.000Z');
    expect(getMsUntilMidnight(oneMinBeforeTokyoMidnight, 'Asia/Tokyo')).toBe(60000);

    const morningInNY = new Date('2026-07-26T14:59:00.000Z'); // 10:59 EDT
    const msToMidnightNY = 13 * 3600 * 1000 + 60 * 1000;
    expect(getMsUntilMidnight(morningInNY, 'America/New_York')).toBe(msToMidnightNY);
  });
});


describe('week start date helpers', () => {
  it('orders weekday labels from the configured first day', () => {
    expect(weekdayInitials('sunday')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(weekdayInitials('monday')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(weekdayShortNames('sunday')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(weekdayShortNames('monday')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('returns Brazilian Portuguese weekday labels', () => {
    expect(weekdayInitials('sunday', 'pt-BR')).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
    expect(weekdayShortNames('monday', 'pt-BR')).toEqual(['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.']);
  });

  it('maps JavaScript weekdays into the configured calendar columns', () => {
    expect(weekdayColumnIndex(0, 'sunday')).toBe(0);
    expect(weekdayColumnIndex(0, 'monday')).toBe(6);
    expect(weekdayColumnIndex(1, 'monday')).toBe(0);
  });

  it('builds month offsets without changing the represented dates', () => {
    const today = new Date(2026, 7, 31);
    const sundayFirst = buildMonthDays(2026, 7, today, 'sunday');
    const mondayFirst = buildMonthDays(2026, 7, today, 'monday');

    expect(sundayFirst[0]).toMatchObject({ iso: '2026-08-01', dayOfMonth: 1, dow: 6 });
    expect(mondayFirst[0]).toMatchObject({ iso: '2026-08-01', dayOfMonth: 1, dow: 5 });
    expect(mondayFirst.map((day) => day.iso)).toEqual(sundayFirst.map((day) => day.iso));
  });
});

describe('Brazilian Portuguese natural dates', () => {
  it.each([
    ['ontem', -1],
    ['hoje', 0],
    ['amanhã', 1],
    ['em 3 dias', 3],
  ])('parses %s', (phrase, offset) => {
    const parsed = parseNaturalDate(`Comprar pão ${phrase}`, 'pt-BR');
    const expected = new Date();
    expected.setDate(expected.getDate() + offset);

    expect(parsed?.isoDate).toBe([
      expected.getFullYear(),
      String(expected.getMonth() + 1).padStart(2, '0'),
      String(expected.getDate()).padStart(2, '0'),
    ].join('-'));
    expect(parsed?.preview).toMatch(/[a-zá-ú]/iu);
  });

  it('extracts Portuguese phrases and keeps recurrence metadata', () => {
    expect(extractNaturalDate('Revisar agenda toda semana', undefined, 'pt-BR')).toMatchObject({
      title: 'Revisar agenda',
      recurrenceRule: { type: 'weekly', interval: 1 },
    });
    expect(extractNaturalDate('Planejar próxima segunda-feira', undefined, 'pt-BR').title).toBe('Planejar');
  });

  it('parses masculine Portuguese weekday phrases', () => {
    const recurring = parseNaturalDate('Revisar todo domingo', 'pt-BR');
    expect(recurring?.recurrenceRule).toEqual({ type: 'weekly', interval: 1, weekdays: [0] });
    expect(recurring?.text).toBe('todo domingo');

    const nextSaturday = parseNaturalDate('Comprar pão próximo sábado', 'pt-BR');
    expect(nextSaturday?.text).toBe('próximo sábado');
    expect(new Date(`${nextSaturday?.isoDate}T12:00:00`).getDay()).toBe(6);
  });

  it('keeps English phrases working by default', () => {
    expect(extractNaturalDate('Plan tomorrow').title).toBe('Plan');
    expect(extractNaturalDate('Review yesterday').title).toBe('Review');
  });

  it('parses "todo dia N" as a monthly recurrence on day N', () => {
    const today = new Date();
    const dayAfterToday = Math.min(today.getDate() + 1, 28);
    const parsed = parseNaturalDate(`Pagar aluguel todo dia ${dayAfterToday}`, 'pt-BR');

    expect(parsed?.text).toBe(`todo dia ${dayAfterToday}`);
    expect(parsed?.recurrenceRule).toEqual({ type: 'monthly', interval: 1, dayOfMonth: dayAfterToday });
    expect(parsed?.isoDate.endsWith(String(dayAfterToday).padStart(2, '0'))).toBe(true);
  });

  it('rolls "todo dia N" into next month once day N has already passed', () => {
    const fixedToday = new Date(2026, 8, 20); // Sep 20, 2026
    const realDate = Date;
    vi.useFakeTimers();
    vi.setSystemTime(fixedToday);

    const parsed = parseNaturalDate('Pagar aluguel todo dia 5', 'pt-BR');

    expect(parsed?.recurrenceRule).toEqual({ type: 'monthly', interval: 1, dayOfMonth: 5 });
    expect(parsed?.isoDate).toBe('2026-10-05');

    vi.useRealTimers();
    expect(Date).toBe(realDate);
  });

  it('clamps "todo dia 31" to the last day of shorter months', () => {
    const fixedToday = new Date(2026, 3, 15); // Apr 15, 2026 (30-day month)
    vi.useFakeTimers();
    vi.setSystemTime(fixedToday);

    const parsed = parseNaturalDate('Pagar aluguel todo dia 31', 'pt-BR');

    expect(parsed?.recurrenceRule).toEqual({ type: 'monthly', interval: 1, dayOfMonth: 31 });
    expect(parsed?.isoDate).toBe('2026-04-30');

    vi.useRealTimers();
  });

  it('strips the day number from the title and keeps recurrence metadata', () => {
    expect(extractNaturalDate('Pagar aluguel todo dia 15', undefined, 'pt-BR')).toMatchObject({
      title: 'Pagar aluguel',
      recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 15 },
    });
  });

  it('ignores an out-of-range day and falls back to plain "todo dia" (daily)', () => {
    const parsed = parseNaturalDate('Pagar aluguel todo dia 40', 'pt-BR');
    expect(parsed?.recurrenceRule).toEqual({ type: 'daily', interval: 1 });
  });
});
