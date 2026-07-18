import { describe, it, expect } from 'vitest';
import { evaluateFilter, type EvalTask, type EvalContext } from '../filterEvaluator.js';
import type { FilterExpr } from '../../parsers/filterParser.js';

function task(overrides: Partial<EvalTask> = {}): EvalTask {
  return {
    id: 't1',
    title: 'Test',
    description: null,
    collectionName: 'work',
    labelNames: [],
    priority: 4,
    dueDate: null,
    assigneeUser: null,
    isCompleted: false,
    ...overrides,
  };
}

const ctx: EvalContext = { today: '2024-06-15', currentUser: 'me-id' };

describe('filterEvaluator', () => {
  it('collection matches by name', () => {
    const e: FilterExpr = { type: 'collection', name: 'work' };
    expect(evaluateFilter(e, [task({ collectionName: 'work' }), task({ collectionName: 'home' })], ctx)).toHaveLength(1);
  });

  it('label matches if task has the label', () => {
    const e: FilterExpr = { type: 'label', name: 'urgent' };
    expect(evaluateFilter(e, [task({ labelNames: ['urgent', 'home'] }), task({ labelNames: [] })], ctx)).toHaveLength(1);
  });

  it('priority equality', () => {
    const e: FilterExpr = { type: 'priority', level: 1 };
    expect(evaluateFilter(e, [task({ priority: 1 }), task({ priority: 2 })], ctx)).toHaveLength(1);
  });

  it('today matches due_date === today', () => {
    const e: FilterExpr = { type: 'today' };
    expect(evaluateFilter(e, [task({ dueDate: '2024-06-15' }), task({ dueDate: '2024-06-14' })], ctx)).toHaveLength(1);
  });

  it('overdue: due_date strictly before today', () => {
    const e: FilterExpr = { type: 'overdue' };
    expect(evaluateFilter(e, [
      task({ dueDate: '2024-06-14' }),
      task({ dueDate: '2024-06-15' }),
      task({ dueDate: null }),
    ], ctx)).toHaveLength(1);
  });

  it('noDate: due_date is null', () => {
    const e: FilterExpr = { type: 'noDate' };
    expect(evaluateFilter(e, [task({ dueDate: null }), task({ dueDate: '2024-06-15' })], ctx)).toHaveLength(1);
  });

  it('dueOn / dueBefore / dueAfter', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2024-06-10' }),
      task({ id: 'b', dueDate: '2024-06-15' }),
      task({ id: 'c', dueDate: '2024-06-20' }),
    ];
    expect(evaluateFilter({ type: 'dueOn', date: '2024-06-15' }, tasks, ctx).map(t => t.id)).toEqual(['b']);
    expect(evaluateFilter({ type: 'dueBefore', date: '2024-06-15' }, tasks, ctx).map(t => t.id)).toEqual(['a']);
    expect(evaluateFilter({ type: 'dueAfter', date: '2024-06-15' }, tasks, ctx).map(t => t.id)).toEqual(['c']);
  });

  it('assignedTo me uses currentUser', () => {
    const e: FilterExpr = { type: 'assignedTo', user: 'me' };
    expect(evaluateFilter(e, [
      task({ assigneeUser: 'me-id' }),
      task({ assigneeUser: 'someone-else' }),
    ], ctx)).toHaveLength(1);
  });

  it('text: case-insensitive substring match on title or description', () => {
    const e: FilterExpr = { type: 'text', value: 'meeting' };
    expect(evaluateFilter(e, [
      task({ id: 'a', title: 'Daily MEETING prep' }),
      task({ id: 'b', title: 'Lunch', description: 'meeting notes' }),
      task({ id: 'c', title: 'Other' }),
    ], ctx).map(t => t.id)).toEqual(['a', 'b']);
  });

  it('and/or/not compose correctly', () => {
    const tasks = [
      task({ id: 'a', priority: 1, labelNames: ['urgent'] }),
      task({ id: 'b', priority: 1, labelNames: [] }),
      task({ id: 'c', priority: 4, labelNames: ['urgent'] }),
    ];
    const e: FilterExpr = {
      type: 'and',
      left: { type: 'priority', level: 1 },
      right: { type: 'label', name: 'urgent' },
    };
    expect(evaluateFilter(e, tasks, ctx).map(t => t.id)).toEqual(['a']);

    const orExpr: FilterExpr = {
      type: 'or',
      left: { type: 'priority', level: 1 },
      right: { type: 'label', name: 'urgent' },
    };
    expect(evaluateFilter(orExpr, tasks, ctx).map(t => t.id)).toEqual(['a', 'b', 'c']);

    const notExpr: FilterExpr = { type: 'not', expr: { type: 'priority', level: 1 } };
    expect(evaluateFilter(notExpr, tasks, ctx).map(t => t.id)).toEqual(['c']);
  });
});
