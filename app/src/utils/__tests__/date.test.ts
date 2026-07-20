import { describe, expect, it } from 'vitest';
import {
  buildMonthDays,
  weekdayColumnIndex,
  weekdayInitials,
  weekdayShortNames,
} from '../date';

describe('week start date helpers', () => {
  it('orders weekday labels from the configured first day', () => {
    expect(weekdayInitials('sunday')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(weekdayInitials('monday')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(weekdayShortNames('sunday')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(weekdayShortNames('monday')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
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
