import { describe, expect, it } from 'vitest';
import { buildColumnId, buildColumns, buildStatusListGroups, parseColumnId } from '../boardColumns';
import type { ApiTask } from '../../api/client';

const baseTask: ApiTask = {
  id: 'task-1',
  title: 'Task',
  priority: 4,
  collectionId: 'collection-1',
  isCompleted: false,
  orderValue: 1000,
  type: 'task',
};

describe('board column ids', () => {
  it('round-trips every v1 group kind', () => {
    expect(parseColumnId(buildColumnId('status', 'status-1'))).toEqual({ groupBy: 'status', value: 'status-1' });
    expect(parseColumnId(buildColumnId('section', null))).toEqual({ groupBy: 'section', value: null });
    expect(parseColumnId(buildColumnId('priority', 2))).toEqual({ groupBy: 'priority', value: 2 });
  });

  it('rejects malformed ids and priorities', () => {
    expect(parseColumnId('priority:5')).toBeNull();
    expect(parseColumnId('label:bug')).toBeNull();
  });
});

describe('buildColumns', () => {
  it('uses board positions without changing list order and omits child cards', () => {
    const tasks = [
      { ...baseTask, id: 'a', statusId: 'status-1', orderValue: 0 },
      { ...baseTask, id: 'b', statusId: 'status-1', orderValue: 1000 },
      { ...baseTask, id: 'child', statusId: 'status-1', parentTaskId: 'a', orderValue: 500 },
    ];
    const [column] = buildColumns({
      groupBy: 'status',
      tasks,
      statuses: [{
        id: 'status-1', collectionId: 'collection-1', name: 'Todo', color: '#adb9c1',
        isDoneLike: false, orderValue: 0, createdAt: '', updatedAt: '',
      }],
      sections: [],
      boardOrder: { status: { a: 2000, b: 1000 }, priority: {} },
      noSectionTitle: 'No section',
      priorityTitle: (priority) => `P${priority}`,
    });

    expect(column.tasks.map((task) => task.id)).toEqual(['b', 'a']);
    expect(tasks.map((task) => task.orderValue)).toEqual([0, 1000, 500]);
  });

  it('always renders four priority columns', () => {
    const columns = buildColumns({
      groupBy: 'priority', tasks: [], statuses: [], sections: [],
      boardOrder: { status: {}, priority: {} }, noSectionTitle: 'No section',
      priorityTitle: (priority) => `P${priority}`,
    });
    expect(columns.map((column) => column.id)).toEqual(['priority:1', 'priority:2', 'priority:3', 'priority:4']);
  });
});

describe('buildStatusListGroups', () => {
  const statuses = [
    {
      id: 'backlog', collectionId: 'collection-1', name: 'Backlog', color: '#adb9c1',
      isDoneLike: false, orderValue: 0, createdAt: '', updatedAt: '',
    },
    {
      id: 'completed', collectionId: 'collection-1', name: 'Completed', color: '#8ca46a',
      isDoneLike: true, orderValue: 1000, createdAt: '', updatedAt: '',
    },
  ];

  it('preserves root status membership and carries descendants with their root', () => {
    const groups = buildStatusListGroups([
      { ...baseTask, id: 'root', statusId: 'completed' },
      { ...baseTask, id: 'child', parentTaskId: 'root', statusId: null },
      { ...baseTask, id: 'unfiled', statusId: null },
    ], statuses);

    expect(groups.map((group) => [group.title, group.tasks.map((task) => task.id)])).toEqual([
      ['Backlog', ['unfiled']],
      ['Completed', ['root', 'child']],
    ]);
  });
});
