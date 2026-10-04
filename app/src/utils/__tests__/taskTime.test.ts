import { describe, it, expect } from 'vitest';
import { formatDuration, formatTimeWindow, scheduleFieldsFromApi } from '../taskTime';

describe('formatDuration', () => {
  it.each([
    [30, '30m'],
    [60, '1h'],
    [90, '1h 30m'],
    [1440, '24h'],
  ])('%i minutes -> %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatTimeWindow', () => {
  it('returns the start alone without an end', () => {
    expect(formatTimeWindow('14:30', null)).toBe('14:30');
  });

  it('joins start and end with a dash', () => {
    expect(formatTimeWindow('14:30', '16:00')).toBe('14:30-16:00');
  });
});

describe('scheduleFieldsFromApi', () => {
  it('copies time fields and trims the deadline to a date key', () => {
    expect(
      scheduleFieldsFromApi({
        dueTime: '14:30',
        endTime: '16:00',
        deadlineDate: '2026-10-06T00:00:00.000Z',
        deadlineTime: '18:00',
        durationMinutes: 90,
      }),
    ).toEqual({
      dueTime: '14:30',
      endTime: '16:00',
      deadlineDate: '2026-10-06',
      deadlineTime: '18:00',
      durationMinutes: 90,
    });
  });

  it('maps missing fields to null', () => {
    expect(scheduleFieldsFromApi({})).toEqual({
      dueTime: null,
      endTime: null,
      deadlineDate: null,
      deadlineTime: null,
      durationMinutes: null,
    });
  });
});
