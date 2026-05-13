import { describe, it, expect } from 'vitest';
import { computeNextOccurrence, DueDate, RecurrenceRule } from '../recurrenceEngine.js';

describe('recurrenceEngine', () => {
  describe('daily', () => {
    it('adds N days', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'daily', interval: 3 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-01-18');
    });

    it('crosses month boundary', () => {
      const due: DueDate = { date: '2024-01-30' };
      const rule: RecurrenceRule = { type: 'daily', interval: 5 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-02-04');
    });

    it('crosses year boundary', () => {
      const due: DueDate = { date: '2024-12-30' };
      const rule: RecurrenceRule = { type: 'daily', interval: 3 };
      expect(computeNextOccurrence(due, rule).date).toBe('2025-01-02');
    });
  });

  describe('weekly', () => {
    it('advances N weeks when no weekdays specified', () => {
      const due: DueDate = { date: '2024-01-15' }; // Monday
      const rule: RecurrenceRule = { type: 'weekly', interval: 2 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-01-29');
    });

    it('finds next matching weekday in same week', () => {
      // 2024-01-15 is Monday (1)
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'weekly', interval: 1, weekdays: [1, 3, 5] }; // Mon, Wed, Fri
      // Next after Monday should be Wednesday
      expect(computeNextOccurrence(due, rule).date).toBe('2024-01-17');
    });

    it('wraps to next interval week when no later day in current week', () => {
      // 2024-01-19 is Friday (5)
      const due: DueDate = { date: '2024-01-19' };
      const rule: RecurrenceRule = { type: 'weekly', interval: 1, weekdays: [1, 3, 5] }; // Mon, Wed, Fri
      // Next after Friday: wrap to Monday of next week
      expect(computeNextOccurrence(due, rule).date).toBe('2024-01-22');
    });

    it('respects interval when wrapping weeks', () => {
      // 2024-01-19 is Friday (5)
      const due: DueDate = { date: '2024-01-19' };
      const rule: RecurrenceRule = { type: 'weekly', interval: 2, weekdays: [1] }; // Mon, every 2 weeks
      // Skip 1 week, land on Monday 2 weeks later
      expect(computeNextOccurrence(due, rule).date).toBe('2024-01-29');
    });
  });

  describe('monthly', () => {
    it('same day next month', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-02-15');
    });

    it('clamps to last day of month (Jan 31 + 1 month)', () => {
      const due: DueDate = { date: '2024-01-31' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-02-29'); // 2024 is leap year
    });

    it('clamps to last day of month in non-leap year', () => {
      const due: DueDate = { date: '2023-01-31' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1 };
      expect(computeNextOccurrence(due, rule).date).toBe('2023-02-28');
    });

    it('uses dayOfMonth when specified', () => {
      const due: DueDate = { date: '2024-01-10' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1, dayOfMonth: 25 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-02-25');
    });

    it('clamps dayOfMonth to month end', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1, dayOfMonth: 31 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-02-29');
    });

    it('handles interval > 1', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 3 };
      expect(computeNextOccurrence(due, rule).date).toBe('2024-04-15');
    });
  });

  describe('yearly', () => {
    it('same date next year', () => {
      const due: DueDate = { date: '2024-03-15' };
      const rule: RecurrenceRule = { type: 'yearly', interval: 1 };
      expect(computeNextOccurrence(due, rule).date).toBe('2025-03-15');
    });

    it('handles Feb 29 in leap year to non-leap year', () => {
      const due: DueDate = { date: '2024-02-29' };
      const rule: RecurrenceRule = { type: 'yearly', interval: 1 };
      expect(computeNextOccurrence(due, rule).date).toBe('2025-02-28');
    });

    it('uses month and dayOfMonth when specified', () => {
      const due: DueDate = { date: '2024-01-01' };
      const rule: RecurrenceRule = { type: 'yearly', interval: 1, month: 6, dayOfMonth: 15 };
      expect(computeNextOccurrence(due, rule).date).toBe('2025-06-15');
    });

    it('handles interval > 1', () => {
      const due: DueDate = { date: '2024-03-15' };
      const rule: RecurrenceRule = { type: 'yearly', interval: 2 };
      expect(computeNextOccurrence(due, rule).date).toBe('2026-03-15');
    });
  });

  describe('preserves time and timezone', () => {
    it('preserves time component', () => {
      const due: DueDate = { date: '2024-01-15', time: '14:30' };
      const rule: RecurrenceRule = { type: 'daily', interval: 1 };
      const result = computeNextOccurrence(due, rule);
      expect(result.time).toBe('14:30');
    });

    it('preserves timezone', () => {
      const due: DueDate = { date: '2024-01-15', timezone: 'America/New_York' };
      const rule: RecurrenceRule = { type: 'daily', interval: 1 };
      const result = computeNextOccurrence(due, rule);
      expect(result.timezone).toBe('America/New_York');
    });

    it('preserves both time and timezone', () => {
      const due: DueDate = { date: '2024-01-15', time: '09:00', timezone: 'Europe/London' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1 };
      const result = computeNextOccurrence(due, rule);
      expect(result.time).toBe('09:00');
      expect(result.timezone).toBe('Europe/London');
    });

    it('does not add time/timezone when not present', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'daily', interval: 1 };
      const result = computeNextOccurrence(due, rule);
      expect(result.time).toBeUndefined();
      expect(result.timezone).toBeUndefined();
    });
  });

  describe('preserves recurrence rule', () => {
    it('attaches rule to output', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'weekly', interval: 2, weekdays: [1, 3] };
      const result = computeNextOccurrence(due, rule);
      expect(result.recurrence).toEqual(rule);
    });
  });

  describe('result is strictly after current date', () => {
    it('daily interval 1 is next day', () => {
      const due: DueDate = { date: '2024-01-15' };
      const rule: RecurrenceRule = { type: 'daily', interval: 1 };
      const result = computeNextOccurrence(due, rule);
      expect(result.date > due.date).toBe(true);
    });

    it('monthly result is after current', () => {
      const due: DueDate = { date: '2024-01-31' };
      const rule: RecurrenceRule = { type: 'monthly', interval: 1 };
      const result = computeNextOccurrence(due, rule);
      expect(result.date > due.date).toBe(true);
    });
  });
});
