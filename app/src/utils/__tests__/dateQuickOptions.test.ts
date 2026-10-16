import { describe, it, expect } from 'vitest';
import { dateQuickOptions, formatShortDay } from '../dateQuickOptions';

describe('formatShortDay', () => {
  it('prints a compact weekday, day and month', () => {
    expect(formatShortDay('2026-10-15', 'pt-BR')).toBe('Qui, 15 out');
    expect(formatShortDay('2026-10-17', 'pt-BR')).toBe('Sáb, 17 out');
    expect(formatShortDay('2026-10-15', 'en')).toBe('Thu, Oct 15');
  });
});

const dates = (today: Date, weekStart: 'sunday' | 'monday') =>
  Object.fromEntries(dateQuickOptions(today, weekStart).map((o) => [o.key, o.date]));

describe('dateQuickOptions', () => {
  it('resolves today, tomorrow, the weekend and next week from a Thursday', () => {
    expect(dates(new Date(2026, 9, 15), 'monday')).toEqual({
      today: '2026-10-15',
      tomorrow: '2026-10-16',
      weekend: '2026-10-17',
      nextWeek: '2026-10-19',
    });
  });

  it('starts next week on the preferred week-start day', () => {
    expect(dates(new Date(2026, 9, 15), 'sunday').nextWeek).toBe('2026-10-18');
  });

  it('keeps the weekend on today when it is already Saturday', () => {
    expect(dates(new Date(2026, 9, 17), 'monday').weekend).toBe('2026-10-17');
  });

  it('jumps a full week when today is the week-start day', () => {
    expect(dates(new Date(2026, 9, 19), 'monday').nextWeek).toBe('2026-10-26');
  });

  it('lists the options in display order', () => {
    expect(dateQuickOptions(new Date(2026, 9, 15), 'monday').map((o) => o.key)).toEqual([
      'today',
      'tomorrow',
      'weekend',
      'nextWeek',
    ]);
  });
});
