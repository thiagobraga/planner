import { describe, expect, it } from 'vitest';
import { scheduleOf } from '../taskDateMenuItem';

describe('scheduleOf', () => {
  it('trims API timestamps to date keys so the picker can read them', () => {
    expect(
      scheduleOf({
        id: 't1',
        title: 'Read',
        priority: 4,
        isCompleted: false,
        orderValue: 0,
        type: 'task',
        dueDate: '2026-10-15T00:00:00.000Z',
        deadlineDate: '2026-10-19T00:00:00.000Z',
        recurrenceRule: { type: 'daily', interval: 1 },
      }),
    ).toEqual({
      dueDate: '2026-10-15',
      dueTime: null,
      deadlineDate: '2026-10-19',
      deadlineTime: null,
      durationMinutes: null,
      recurrenceRule: { type: 'daily', interval: 1 },
    });
  });
});
