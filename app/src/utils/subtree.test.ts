import { describe, expect, it } from 'vitest';
import { flattenSubtree, leafProgress } from './subtree';
import type { TaskDetailItem } from '../contracts/taskDetail';

const item = (id: string, parentTaskId: string | null, extra: Partial<TaskDetailItem> = {}): TaskDetailItem => ({
  id, parentTaskId, collectionId: 'c', sectionId: null, title: id, type: 'task', isCompleted: false,
  statusId: null, priority: 4, dueDate: null, deadlineDate: null, orderValue: 0, depth: 0, ...extra,
});

describe('flattenSubtree', () => {
  it('walks children depth first in order value order with their depth below the root', () => {
    const rows = flattenSubtree('root', [
      item('b', 'root', { orderValue: 2 }),
      item('a', 'root', { orderValue: 1 }),
      item('a2', 'a', { orderValue: 2 }),
      item('a1', 'a', { orderValue: 1 }),
      item('stray', 'elsewhere'),
    ]);
    expect(rows.map((row) => [row.item.id, row.depth])).toEqual([['a', 0], ['a1', 1], ['a2', 1], ['b', 0]]);
  });

  it('survives a parent cycle without looping', () => {
    const rows = flattenSubtree('root', [item('a', 'root'), item('b', 'a'), item('root', 'b')]);
    expect(rows.map((row) => row.item.id)).toEqual(['a', 'b']);
  });
});

describe('leafProgress', () => {
  it('reports no subtasks when there are no task descendants', () => {
    expect(leafProgress('root', [])).toEqual({ done: 0, total: 0 });
    expect(leafProgress('root', [item('n', 'root', { type: 'note' }), item('e', 'root', { type: 'event' })])).toEqual({ done: 0, total: 0 });
  });

  it('counts unique task leaves only, not parents, notes or events', () => {
    const items = [
      item('parent', 'root'),
      item('leaf1', 'parent', { isCompleted: true }),
      item('leaf2', 'parent'),
      item('leaf3', 'root', { isCompleted: true }),
      item('withNote', 'root'),
      item('note', 'withNote', { type: 'note' }),
      item('leaf3', 'root', { isCompleted: true }),
    ];
    expect(leafProgress('root', items)).toEqual({ done: 2, total: 4 });
  });
});
