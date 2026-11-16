import { describe, it, expect } from 'vitest';
import { buildDayColumns, slotTaskIntoColumn } from '../dayColumns';
import type { Task } from '../../types/task';

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
  it('returns every day of the range, then Migrate', () => {
    expect(buildDayColumns('2026-09-20', '2026-09-26').map((c) => c.id)).toEqual([
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

  it('handles a single day and spans across months', () => {
    expect(buildDayColumns('2026-09-22', '2026-09-22').map((c) => c.id)).toEqual(['day:2026-09-22', 'migrate']);
    const columns = buildDayColumns('2026-09-29', '2026-10-02');
    expect(columns.map((c) => c.iso)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', null]);
    expect(columns[0]!.weekday).toBe(2);
  });

  it('every column, including Migrate, is droppable', () => {
    expect(buildDayColumns('2026-09-20', '2026-09-26').every((c) => c.droppable)).toBe(true);
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
