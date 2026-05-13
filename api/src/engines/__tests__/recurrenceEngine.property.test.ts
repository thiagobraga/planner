import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeNextOccurrence } from '../recurrenceEngine.js';
import type { DueDate, RecurrenceRule } from '../recurrenceEngine.js';

const arbValidDate = fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true })
  .map(d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

const arbInterval = fc.integer({ min: 1, max: 999 });
const arbWeekday = fc.integer({ min: 0, max: 6 });

const arbDailyRule: fc.Arbitrary<RecurrenceRule> = arbInterval.map(interval => ({ type: 'daily', interval }));

const arbWeeklyRule: fc.Arbitrary<RecurrenceRule> = fc.oneof(
  fc.tuple(arbInterval, fc.uniqueArray(arbWeekday, { minLength: 1, maxLength: 7 }))
    .map(([interval, weekdays]) => ({ type: 'weekly' as const, interval, weekdays })),
  arbInterval.map(interval => ({ type: 'weekly' as const, interval })),
);

const arbMonthlyRule: fc.Arbitrary<RecurrenceRule> = fc.tuple(arbInterval, fc.option(fc.integer({ min: 1, max: 31 }), { nil: undefined }))
  .map(([interval, dayOfMonth]) => {
    const rule: RecurrenceRule = { type: 'monthly', interval };
    if (dayOfMonth !== undefined) rule.dayOfMonth = dayOfMonth;
    return rule;
  });

const arbYearlyRule: fc.Arbitrary<RecurrenceRule> = fc.tuple(
  arbInterval,
  fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
  fc.option(fc.integer({ min: 1, max: 31 }), { nil: undefined }),
).map(([interval, month, dayOfMonth]) => {
  const rule: RecurrenceRule = { type: 'yearly', interval };
  if (month !== undefined) rule.month = month;
  if (dayOfMonth !== undefined) rule.dayOfMonth = dayOfMonth;
  return rule;
});

const arbAnyRule: fc.Arbitrary<RecurrenceRule> = fc.oneof(arbDailyRule, arbWeeklyRule, arbMonthlyRule, arbYearlyRule);

function dateAsDays(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

describe('Property 3: Recurrence strict monotonicity (Requirements 14.2, 14.9)', () => {
  it('next occurrence is strictly after the current due date for any valid rule', () => {
    fc.assert(
      fc.property(arbValidDate, arbAnyRule, (date, rule) => {
        const due: DueDate = { date };
        const next = computeNextOccurrence(due, rule);
        expect(dateAsDays(next.date)).toBeGreaterThan(dateAsDays(date));
      }),
      { numRuns: 200 },
    );
  });

  it('iterating yields a strictly increasing sequence (10 steps)', () => {
    fc.assert(
      fc.property(arbValidDate, arbAnyRule, (date, rule) => {
        let current: DueDate = { date, recurrence: rule };
        let prev = dateAsDays(current.date);
        for (let i = 0; i < 10; i++) {
          current = computeNextOccurrence(current, rule);
          const days = dateAsDays(current.date);
          expect(days).toBeGreaterThan(prev);
          prev = days;
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe('Property 4: Recurrence weekday correctness (Requirements 14.4)', () => {
  it('weekly with weekdays always lands on one of those weekdays', () => {
    fc.assert(
      fc.property(arbValidDate, fc.uniqueArray(arbWeekday, { minLength: 1, maxLength: 7 }), arbInterval, (date, weekdays, interval) => {
        const rule: RecurrenceRule = { type: 'weekly', interval, weekdays };
        const next = computeNextOccurrence({ date }, rule);
        const [y, m, d] = next.date.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        expect(weekdays).toContain(dow);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 5: Recurrence N-day arithmetic (Requirements 14.5)', () => {
  it('every N days advances exactly N days', () => {
    fc.assert(
      fc.property(arbValidDate, arbInterval, (date, interval) => {
        const rule: RecurrenceRule = { type: 'daily', interval };
        const next = computeNextOccurrence({ date }, rule);
        expect(dateAsDays(next.date) - dateAsDays(date)).toBe(interval);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 6: Recurrence time preservation (Requirements 14.6)', () => {
  it('time component is preserved across any rule type', () => {
    const arbTime = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
      .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

    fc.assert(
      fc.property(arbValidDate, arbTime, arbAnyRule, (date, time, rule) => {
        const due: DueDate = { date, time };
        const next = computeNextOccurrence(due, rule);
        expect(next.time).toBe(time);
      }),
      { numRuns: 200 },
    );
  });

  it('timezone is preserved when present', () => {
    fc.assert(
      fc.property(arbValidDate, arbAnyRule, (date, rule) => {
        const due: DueDate = { date, time: '09:30', timezone: 'America/New_York' };
        const next = computeNextOccurrence(due, rule);
        expect(next.timezone).toBe('America/New_York');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 7: Recurrence month-end clamping (Requirements 14.7)', () => {
  function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  it('monthly targeting day 31 clamps to last day of target month', () => {
    fc.assert(
      fc.property(arbValidDate, arbInterval, (date, interval) => {
        const rule: RecurrenceRule = { type: 'monthly', interval, dayOfMonth: 31 };
        const next = computeNextOccurrence({ date }, rule);
        const [y, m, d] = next.date.split('-').map(Number);
        const lastDay = daysInMonth(y, m);
        expect(d).toBe(lastDay);
      }),
      { numRuns: 200 },
    );
  });

  it('monthly never produces a day exceeding the target month length', () => {
    fc.assert(
      fc.property(
        arbValidDate,
        arbInterval,
        fc.integer({ min: 1, max: 31 }),
        (date, interval, dayOfMonth) => {
          const rule: RecurrenceRule = { type: 'monthly', interval, dayOfMonth };
          const next = computeNextOccurrence({ date }, rule);
          const [y, m, d] = next.date.split('-').map(Number);
          expect(d).toBeLessThanOrEqual(daysInMonth(y, m));
          expect(d).toBeLessThanOrEqual(dayOfMonth);
        },
      ),
      { numRuns: 200 },
    );
  });
});
