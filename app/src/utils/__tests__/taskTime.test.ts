import { describe, it, expect } from 'vitest';
import { applySchedule, formatDuration, formatTimeWindow, scheduleFieldsFromApi } from '../taskTime';

describe('applySchedule', () => {
  const task = { id: 't1', title: 'Run', dueDate: '2026-10-15', dueTime: null, endTime: null };

  it('writes every schedule field and derives the end time', () => {
    expect(
      applySchedule(task, {
        dueDate: '2026-10-17',
        dueTime: '23:30',
        deadlineDate: '2026-10-19',
        deadlineTime: '18:00',
        durationMinutes: 45,
        recurrenceRule: { type: 'daily', interval: 1 },
      }),
    ).toEqual({
      id: 't1',
      title: 'Run',
      dueDate: '2026-10-17',
      dueTime: '23:30',
      endTime: '00:15',
      deadlineDate: '2026-10-19',
      deadlineTime: '18:00',
      durationMinutes: 45,
      recurrenceRule: { type: 'daily', interval: 1 },
    });
  });

  it('clears the date to undefined and drops the end time without a start', () => {
    const cleared = applySchedule(task, {
      dueDate: null,
      dueTime: null,
      deadlineDate: null,
      deadlineTime: null,
      durationMinutes: 30,
      recurrenceRule: null,
    });
    expect(cleared.dueDate).toBeUndefined();
    expect(cleared.endTime).toBeNull();
  });
});

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
        recurrenceRule: { type: 'weekly', interval: 2, weekdays: [6] },
      }),
    ).toEqual({
      dueTime: '14:30',
      endTime: '16:00',
      deadlineDate: '2026-10-06',
      deadlineTime: '18:00',
      durationMinutes: 90,
      recurrenceRule: { type: 'weekly', interval: 2, weekdays: [6] },
    });
  });

  it('maps missing fields to null', () => {
    expect(scheduleFieldsFromApi({})).toEqual({
      dueTime: null,
      endTime: null,
      deadlineDate: null,
      deadlineTime: null,
      durationMinutes: null,
      recurrenceRule: null,
    });
  });
});
