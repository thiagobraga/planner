import { describe, it, expect } from 'vitest';
import { buildDayColumns, slotTaskIntoColumn } from '../dayColumns';
import type { Task } from '../../components/TaskItem';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    priority: 4,
    isCompleted: false,
    orderValue: 0,
    type: 'task',
    ...overrides,
  };
}

describe('buildDayColumns', () => {
  it('returns the 7 days, then Migrate - sunday-first week', () => {
    // 2026-09-22 is a Tuesday. Local-time constructor - fmtISO/buildWeekDays
    // read local getters, so a UTC-Z string would shift a day west of UTC.
    const anchor = new Date(2026, 8, 22);
    const today = anchor;
    const columns = buildDayColumns(anchor, today, 'sunday');

    expect(columns.map((c) => c.id)).toEqual([
      'day:2026-09-20',
      'day:2026-09-21',
      'day:2026-09-22',
      'day:2026-09-23',
      'day:2026-09-24',
      'day:2026-09-25',
      'day:2026-09-26',
      'migrate',
    ]);
  });

  it('shifts to a monday-first week when weekStart is monday', () => {
    const anchor = new Date(2026, 8, 22);
    const columns = buildDayColumns(anchor, anchor, 'monday');

    expect(columns[0]!.id).toBe('day:2026-09-21');
    expect(columns[6]!.id).toBe('day:2026-09-27');
    expect(columns[7]!.id).toBe('migrate');
  });

  it('every column, including Migrate, is droppable', () => {
    const anchor = new Date(2026, 8, 22);
    const columns = buildDayColumns(anchor, anchor, 'sunday');

    expect(columns.every((c) => c.droppable)).toBe(true);
  });
});

describe('slotTaskIntoColumn', () => {
  const todayKey = '2026-09-22';

  it('slots an overdue task into Migrate', () => {
    expect(slotTaskIntoColumn(task({ dueDate: '2026-09-21' }), todayKey)).toBe('migrate');
  });

  it('slots an undated task into Migrate', () => {
    expect(slotTaskIntoColumn(task({ dueDate: undefined }), todayKey)).toBe('migrate');
  });

  it('slots a task due today into that day column', () => {
    expect(slotTaskIntoColumn(task({ dueDate: '2026-09-22' }), todayKey)).toBe('day:2026-09-22');
  });

  it('slots a future-dated task into its day column', () => {
    expect(slotTaskIntoColumn(task({ dueDate: '2026-09-25' }), todayKey)).toBe('day:2026-09-25');
  });
});
