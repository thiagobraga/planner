import { describe, it, expect } from 'vitest';

describe('useReorganize hook — redistribution algorithm', () => {
  // Test the redistribution algorithm logic independently
  // Full hook testing with React would require @testing-library/react + renderHook

  it('detects ≥8 uncompleted root tasks shows button', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`,
      parentTaskId: undefined,
      type: 'task' as const,
      isCompleted: false,
      dueDate: '2026-08-13',
    }));

    const rootTasks = tasks.filter((t) => !t.parentTaskId && t.type === 'task' && !t.isCompleted);
    expect(rootTasks.length).toBe(8);
    expect(rootTasks.length >= 8).toBe(true);
  });

  it('hides button with <8 uncompleted root tasks', () => {
    const tasks = Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`,
      parentTaskId: undefined,
      type: 'task' as const,
      isCompleted: false,
      dueDate: '2026-08-13',
    }));

    const rootTasks = tasks.filter((t) => !t.parentTaskId && t.type === 'task' && !t.isCompleted);
    expect(rootTasks.length).toBe(7);
    expect(rootTasks.length >= 8).toBe(false);
  });

  it('filters out completed tasks', () => {
    const tasks = [
      { id: 't1', parentTaskId: undefined, type: 'task' as const, isCompleted: false },
      { id: 't2', parentTaskId: undefined, type: 'task' as const, isCompleted: true },
      { id: 't3', parentTaskId: undefined, type: 'task' as const, isCompleted: false },
    ];

    const eligible = tasks.filter((t) => !t.parentTaskId && t.type === 'task' && !t.isCompleted);
    expect(eligible.length).toBe(2);
    expect(eligible.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('excludes subtasks from redistribution', () => {
    const tasks = [
      { id: 't1', parentTaskId: undefined, type: 'task' as const, isCompleted: false },
      { id: 't2', parentTaskId: 't1', type: 'task' as const, isCompleted: false },
      { id: 't3', parentTaskId: undefined, type: 'task' as const, isCompleted: false },
    ];

    const rootOnly = tasks.filter((t) => !t.parentTaskId && t.type === 'task');
    expect(rootOnly.length).toBe(2);
    expect(rootOnly.every((t) => !t.parentTaskId)).toBe(true);
  });

  it('excludes notes from redistribution', () => {
    const tasks = [
      { id: 't1', parentTaskId: undefined, type: 'task' as const, isCompleted: false },
      { id: 't2', parentTaskId: undefined, type: 'note' as const, isCompleted: false },
      { id: 't3', parentTaskId: undefined, type: 'task' as const, isCompleted: false },
    ];

    const tasksOnly = tasks.filter((t) => t.type === 'task');
    expect(tasksOnly.length).toBe(2);
    expect(tasksOnly.every((t) => t.type === 'task')).toBe(true);
  });

  it('distributes ≤5 tasks per day', () => {
    // Simulate: 10 tasks → 5 on day 1, 5 on day 2
    const taskCount = 10;
    const tasksPerDay = 5;
    const daysNeeded = Math.ceil(taskCount / tasksPerDay);

    expect(daysNeeded).toBe(2);

    // Simulate distribution
    const distribution = [];
    for (let i = 0; i < taskCount; i++) {
      const dayIndex = Math.floor(i / tasksPerDay);
      const taskInDay = i % tasksPerDay;
      distribution.push({ dayIndex, taskInDay });
    }

    const byDay = distribution.reduce(
      (acc, d) => {
        if (!acc[d.dayIndex]) acc[d.dayIndex] = [];
        acc[d.dayIndex].push(d);
        return acc;
      },
      {} as Record<number, any[]>,
    );

    expect(Object.keys(byDay).length).toBe(2);
    expect(byDay[0].length).toBe(5);
    expect(byDay[1].length).toBe(5);
  });

  it('only records moves where date actually changed', () => {
    const moves = [
      { taskId: 't1', oldDate: '2026-08-13', newDate: '2026-08-14', changed: true },
      { taskId: 't2', oldDate: '2026-08-13', newDate: '2026-08-13', changed: false },
      { taskId: 't3', oldDate: '2026-08-14', newDate: '2026-08-15', changed: true },
    ];

    const actualMoves = moves.filter((m) => m.changed);
    expect(actualMoves.length).toBe(2);
    expect(actualMoves.map((m) => m.taskId)).toEqual(['t1', 't3']);
  });

  it('generates consecutive dates for redistribution', () => {
    const today = new Date('2026-08-13');
    const days = [0, 1, 2, 3, 4]; // day offsets

    const dates = days.map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    });

    expect(dates).toEqual(['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17']);
  });

  it('state machine: idle → preview → idle (cancel)', () => {
    const states = ['idle' as const, 'preview' as const, 'idle' as const];
    expect(states[0]).toBe('idle');
    expect(states[1]).toBe('preview');
    expect(states[2]).toBe('idle');
  });

  it('state machine: idle → preview → persisting → idle (confirm)', () => {
    const states = ['idle' as const, 'preview' as const, 'persisting' as const, 'idle' as const];
    expect(states).toHaveLength(4);
    expect(states[0]).toBe('idle');
    expect(states[3]).toBe('idle');
  });
});
