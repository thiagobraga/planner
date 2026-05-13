import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseDueDate } from '../dateParser.js';
import { printDueDate } from '../datePrinter.js';
import type { DueDate } from '../dateParser.js';

// Generators restricted to forms expressible by the parser grammar
// (per Requirements 13.1-13.7 for inputs the parser supports).

const arbDate = fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true })
  .map(d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

const arbTime = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

const arbInterval = fc.integer({ min: 1, max: 999 });
const arbWeekday = fc.integer({ min: 0, max: 6 });
const arbDayOfMonth = fc.integer({ min: 1, max: 28 });

const arbDailyRule = arbInterval.map(interval => ({ type: 'daily' as const, interval }));

// Weekly: either single weekday (interval=1), or no weekdays (any interval)
const arbWeeklyRule = fc.oneof(
  arbWeekday.map(wd => ({ type: 'weekly' as const, interval: 1, weekdays: [wd] })),
  arbInterval.map(interval => ({ type: 'weekly' as const, interval })),
);

// Monthly: interval=1, optional dayOfMonth (parser only supports interval=1)
const arbMonthlyRule = fc.option(arbDayOfMonth, { nil: undefined }).map(dayOfMonth => {
  const rule: { type: 'monthly'; interval: number; dayOfMonth?: number } = { type: 'monthly', interval: 1 };
  if (dayOfMonth !== undefined) rule.dayOfMonth = dayOfMonth;
  return rule;
});

// Yearly: interval=1 only (parser only supports "every year")
const arbYearlyRule = fc.constant({ type: 'yearly' as const, interval: 1 });

const arbRecurrence = fc.oneof(arbDailyRule, arbWeeklyRule, arbMonthlyRule, arbYearlyRule);

const arbAbsoluteDue: fc.Arbitrary<DueDate> = fc.tuple(arbDate, fc.option(arbTime, { nil: undefined }))
  .map(([date, time]) => time ? { date, time } : { date });

const arbRecurringDue: fc.Arbitrary<DueDate> = fc.tuple(arbRecurrence, fc.option(arbTime, { nil: undefined }))
  .map(([recurrence, time]) => {
    // Parser sets date from "now" for recurrences; we don't assert date round-trip here
    const due: DueDate = { date: '1970-01-01', recurrence };
    if (time) due.time = time;
    return due;
  });

describe('date parser <-> printer round-trip (Property 1, Requirements 13.8/13.9)', () => {
  it('absolute date with optional time: parse(print(d)) === d', () => {
    fc.assert(
      fc.property(arbAbsoluteDue, (due) => {
        const printed = printDueDate(due);
        const parsed = parseDueDate(printed);
        expect(parsed.date).toBe(due.date);
        expect(parsed.time).toBe(due.time);
        expect(parsed.recurrence).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });

  it('recurrence with optional time: parse(print(d)).recurrence === d.recurrence', () => {
    fc.assert(
      fc.property(arbRecurringDue, (due) => {
        const printed = printDueDate(due);
        const parsed = parseDueDate(printed, { now: new Date('2024-06-15T00:00:00Z') });
        expect(parsed.recurrence).toEqual(due.recurrence);
        expect(parsed.time).toBe(due.time);
      }),
      { numRuns: 200 },
    );
  });
});
