import { describe, it, expect } from 'vitest';
import { printDueDate } from '../datePrinter.js';

describe('datePrinter', () => {
  describe('absolute dates', () => {
    it('prints YYYY-MM-DD', () => {
      expect(printDueDate({ date: '2024-03-15' })).toBe('2024-03-15');
    });

    it('prints date with time', () => {
      expect(printDueDate({ date: '2024-03-15', time: '09:30' })).toBe('2024-03-15 09:30');
    });
  });

  describe('recurrence', () => {
    it('every day', () => {
      expect(printDueDate({ date: '2024-03-15', recurrence: { type: 'daily', interval: 1 } })).toBe('every day');
    });

    it('every N days', () => {
      expect(printDueDate({ date: '2024-03-15', recurrence: { type: 'daily', interval: 5 } })).toBe('every 5 days');
    });

    it('every weekday', () => {
      expect(printDueDate({ date: '2024-03-15', recurrence: { type: 'weekly', interval: 1, weekdays: [1] } })).toBe('every monday');
    });

    it('every N weeks', () => {
      expect(printDueDate({ date: '2024-03-15', recurrence: { type: 'weekly', interval: 3 } })).toBe('every 3 weeks');
    });

    it('every month', () => {
      expect(printDueDate({ date: '2024-03-15', recurrence: { type: 'monthly', interval: 1 } })).toBe('every month');
    });

    it('every month on the Nth (ordinals)', () => {
      expect(printDueDate({ date: '2024-03-01', recurrence: { type: 'monthly', interval: 1, dayOfMonth: 1 } })).toBe('every month on the 1st');
      expect(printDueDate({ date: '2024-03-02', recurrence: { type: 'monthly', interval: 1, dayOfMonth: 2 } })).toBe('every month on the 2nd');
      expect(printDueDate({ date: '2024-03-03', recurrence: { type: 'monthly', interval: 1, dayOfMonth: 3 } })).toBe('every month on the 3rd');
      expect(printDueDate({ date: '2024-03-11', recurrence: { type: 'monthly', interval: 1, dayOfMonth: 11 } })).toBe('every month on the 11th');
      expect(printDueDate({ date: '2024-03-21', recurrence: { type: 'monthly', interval: 1, dayOfMonth: 21 } })).toBe('every month on the 21st');
    });

    it('every year', () => {
      expect(printDueDate({ date: '2024-03-15', recurrence: { type: 'yearly', interval: 1 } })).toBe('every year');
    });

    it('recurrence with time', () => {
      expect(printDueDate({ date: '2024-03-15', time: '09:30', recurrence: { type: 'daily', interval: 1 } })).toBe('every day 09:30');
    });
  });
});
