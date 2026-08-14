import { describe, expect, it } from 'vitest';
import { buildColumnId } from '../../utils/boardColumns';
import { applyBoardMoveLocally, resolveBoardMove } from '../useBoardDrag';
import type { ApiSection, ApiStatus, ApiTask, BoardOrder } from '../../api/client';
import type { TaskDragData } from '../../types/drag';

const collectionId = 'collection-1';
const doneStatusId = 'done';

const statuses: ApiStatus[] = [
  { id: 'todo', collectionId, name: 'Todo', color: '#adb9c1', orderValue: 0, createdAt: '', updatedAt: '' },
  { id: doneStatusId, collectionId, name: 'Completed', color: '#8ca46a', orderValue: 1000, createdAt: '', updatedAt: '' },
];

const sections: ApiSection[] = [
  { id: 'work', name: 'Work', collectionId, orderValue: 0 },
  { id: 'home', name: 'Home', collectionId, orderValue: 1000 },
];

const boardOrder: BoardOrder = {
  status: {
    'todo-a': 0,
    'todo-b': 1000,
    'done-a': 0,
    'work-a': 2000,
  },
  priority: {
    'p1-a': 1000,
    'p2-a': 0,
  },
};

function task(partial: Partial<ApiTask> & { id: string; title?: string }): ApiTask {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    priority: partial.priority ?? 4,
    collectionId,
    isCompleted: partial.isCompleted ?? false,
    orderValue: partial.orderValue ?? 0,
    depth: partial.depth ?? 0,
    type: 'task',
    ...partial,
  };
}

function drag(id: string, partial: Partial<TaskDragData> = {}): TaskDragData {
  const task = tasks.find((entry) => entry.id === id)!;
  return {
    kind: 'task',
    taskId: task.id,
    parentTaskId: task.parentTaskId ?? null,
    collectionId,
    sectionId: task.sectionId ?? null,
    dueDate: task.dueDate ?? null,
    depth: task.depth,
    containerId: 'board',
    subtreeIds: subtreeIds(id),
    ...partial,
  };
}

function subtreeIds(id: string): string[] {
  const rows = tasks.filter((task) => task.id === id || task.parentTaskId === id || task.parentTaskId === 'todo-a');
  return rows.map((task) => task.id);
}

const tasks: ApiTask[] = [
  task({ id: 'todo-a', title: 'Todo A', statusId: 'todo', orderValue: 0 }),
  task({ id: 'todo-child', title: 'Todo Child', statusId: 'todo', parentTaskId: 'todo-a', depth: 1, orderValue: 100 }),
  task({ id: 'todo-b', title: 'Todo B', statusId: 'todo', orderValue: 1000 }),
  task({ id: 'done-a', title: 'Done A', statusId: doneStatusId, isCompleted: true, completedAt: '2026-08-14T00:00:00Z', orderValue: 0 }),
  task({ id: 'parent', title: 'Parent', statusId: 'todo', orderValue: 2000 }),
  task({ id: 'child', title: 'Child', statusId: 'todo', parentTaskId: 'todo-a', depth: 1, orderValue: 200 }),
  task({ id: 'work-a', title: 'Work A', sectionId: 'work', orderValue: 0 }),
  task({ id: 'work-child', title: 'Work Child', sectionId: 'work', parentTaskId: 'work-a', depth: 1, orderValue: 100 }),
  task({ id: 'p1-a', title: 'P1', priority: 1, orderValue: 1000 }),
  task({ id: 'p2-a', title: 'P2', priority: 2, orderValue: 0 }),
];

describe('resolveBoardMove', () => {
  it('targets the status column and inserts before the hovered card', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'status',
      collectionId,
      statuses,
      sections,
      active: drag('todo-a'),
      over: drag('todo-b'),
    });

    expect(move?.input).toMatchObject({
      parentTaskId: null,
      statusId: 'todo',
      scope: { kind: 'status', collectionId, statusId: 'todo' },
      position: 0,
    });
    expect(move?.preview).toBe('Drop to move to Todo.');
    expect(move?.announcement).toBe('Moved to Todo.');
  });

  it('uses collection scope for section moves and can target the no-section column', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'section',
      collectionId,
      statuses,
      sections,
      active: drag('work-a'),
      over: {
        kind: 'board-column',
        columnId: buildColumnId('section', null),
        collectionId,
        groupBy: 'section',
        containerId: 'board:section:none',
      },
    } as never);

    expect(move?.input).toMatchObject({
      parentTaskId: null,
      sectionId: null,
      scope: { kind: 'collection', collectionId },
    });
    expect(move?.input.position).toBe(6);
    expect(move?.preview).toBe('Drop to move to No section.');
  });

  it('uses section scope for named section columns', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'section',
      collectionId,
      statuses,
      sections,
      active: drag('todo-a'),
      over: {
        kind: 'board-column',
        columnId: buildColumnId('section', 'home'),
        collectionId,
        groupBy: 'section',
        containerId: 'board:section:home',
      },
    } as never);

    expect(move?.input).toMatchObject({
      parentTaskId: null,
      sectionId: 'home',
      scope: { kind: 'section', sectionId: 'home' },
    });
  });

  it('targets the priority column', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'priority',
      collectionId,
      statuses,
      sections,
      active: drag('p1-a'),
      over: {
        kind: 'board-column',
        columnId: buildColumnId('priority', 2),
        collectionId,
        groupBy: 'priority',
        containerId: 'board:priority:2',
      },
    } as never);

    expect(move?.input).toMatchObject({
      priority: 2,
      scope: { kind: 'priority', collectionId, priority: 2 },
      position: 1,
    });
    expect(move?.announcement).toBe('Moved to Priority 2.');
  });

  it('reparents cards under another card without changing their column membership', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'status',
      collectionId,
      statuses,
      sections,
      active: drag('todo-a'),
      over: {
        kind: 'card-subtasks',
        taskId: 'parent',
        collectionId,
      },
    } as never);

    expect(move?.input).toMatchObject({
      parentTaskId: 'parent',
      scope: { kind: 'status', collectionId, statusId: 'todo' },
      position: Number.MAX_SAFE_INTEGER,
    });
    expect(move?.preview).toBe('Drop to place under Parent.');
  });
});

describe('applyBoardMoveLocally', () => {
  it('ticks the completion column and cascades completion to descendants', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'status',
      collectionId,
      statuses,
      sections,
      active: drag('todo-a'),
      over: {
        kind: 'board-column',
        columnId: buildColumnId('status', doneStatusId),
        collectionId,
        groupBy: 'status',
        containerId: 'board:status:done',
      },
    } as never)!;

    const next = applyBoardMoveLocally({
      tasks,
      boardOrder,
      groupBy: 'status',
      active: drag('todo-a'),
      move,
      completionStatusId: doneStatusId,
    });

    expect(next.tasks.find((task) => task.id === 'todo-a')?.isCompleted).toBe(true);
    expect(next.tasks.find((task) => task.id === 'todo-a')?.parentTaskId).toBeUndefined();
    expect(next.tasks.find((task) => task.id === 'todo-child')?.isCompleted).toBe(true);
    expect(next.tasks.find((task) => task.id === 'child')?.isCompleted).toBe(true);
    expect(next.boardOrder.status['todo-a']).toBe(1000);
  });

  it('clears the section on the moved subtree when a card leaves a section column', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'section',
      collectionId,
      statuses,
      sections,
      active: drag('work-a'),
      over: {
        kind: 'board-column',
        columnId: buildColumnId('section', null),
        collectionId,
        groupBy: 'section',
        containerId: 'board:section:none',
      },
    } as never)!;

    const next = applyBoardMoveLocally({
      tasks,
      boardOrder,
      groupBy: 'section',
      active: drag('work-a'),
      move,
      completionStatusId: doneStatusId,
    });

    expect(next.tasks.find((task) => task.id === 'work-a')?.sectionId).toBeUndefined();
    expect(next.tasks.find((task) => task.id === 'work-child')?.sectionId).toBeUndefined();
    expect(next.tasks.find((task) => task.id === 'work-a')?.orderValue).toBe(6000);
  });

  it('reparents a root card and removes it from board ordering', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'status',
      collectionId,
      statuses,
      sections,
      active: drag('todo-a'),
      over: {
        kind: 'card-subtasks',
        taskId: 'parent',
        collectionId,
      },
    } as never)!;

    const next = applyBoardMoveLocally({
      tasks,
      boardOrder,
      groupBy: 'status',
      active: drag('todo-a'),
      move,
      completionStatusId: doneStatusId,
    });

    expect(next.tasks.find((task) => task.id === 'todo-a')?.parentTaskId).toBe('parent');
    expect(next.tasks.find((task) => task.id === 'todo-a')?.depth).toBe(1);
    expect(next.tasks.find((task) => task.id === 'todo-child')?.depth).toBe(2);
    expect(next.boardOrder.status['todo-a']).toBeUndefined();
  });

  it('reopens a completed card without touching completed descendants', () => {
    const move = resolveBoardMove({
      tasks,
      boardOrder,
      groupBy: 'status',
      collectionId,
      statuses,
      sections,
      active: drag('done-a'),
      over: {
        kind: 'board-column',
        columnId: buildColumnId('status', 'todo'),
        collectionId,
        groupBy: 'status',
        containerId: 'board:status:todo',
      },
    } as never)!;

    const next = applyBoardMoveLocally({
      tasks,
      boardOrder,
      groupBy: 'status',
      active: drag('done-a'),
      move,
      completionStatusId: doneStatusId,
    });

    expect(next.tasks.find((task) => task.id === 'done-a')?.isCompleted).toBe(false);
    expect(next.tasks.find((task) => task.id === 'done-a')?.completedAt).toBeUndefined();
  });
});
