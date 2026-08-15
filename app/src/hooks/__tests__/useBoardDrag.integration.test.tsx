import { act, render } from '@testing-library/react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useBoardDrag } from '../useBoardDrag';
import { apiMoveTask } from '../../api/client';
import type { ApiSection, ApiStatus, ApiTask, BoardOrder } from '../../api/client';
import type { TaskDragData } from '../../types/drag';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveTask: vi.fn(),
}));

const moveTask = vi.mocked(apiMoveTask);

const handlers: {
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
} = {};

const setOverlay = vi.fn();
const announce = vi.fn();

vi.mock('../../contexts/usePlannerDrag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/usePlannerDrag')>();
  return {
    ...actual,
    usePlannerDrag: () => ({
      setOverlay,
      announce,
    }),
    usePlannerDragHandlers: (_kind: string, next: typeof handlers) => {
      Object.assign(handlers, next);
    },
  };
});

const collectionId = 'collection-1';
const doneStatusId = 'done';

const statuses: ApiStatus[] = [
  { id: 'todo', collectionId, name: 'Todo', color: '#adb9c1', orderValue: 0, createdAt: '', updatedAt: '' },
  { id: doneStatusId, collectionId, name: 'Completed', color: '#8ca46a', orderValue: 1000, createdAt: '', updatedAt: '' },
];

const sections: ApiSection[] = [];

let currentTasks: ApiTask[] = [];
let currentBoardOrder: BoardOrder = { status: {}, priority: {} };

function task(partial: Partial<ApiTask> & { id: string }): ApiTask {
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

function dragData(id: string): TaskDragData {
  const task = currentTasks.find((entry) => entry.id === id)!;
  return {
    kind: 'task',
    taskId: task.id,
    parentTaskId: task.parentTaskId ?? null,
    collectionId,
    sectionId: task.sectionId ?? null,
    dueDate: task.dueDate ?? null,
    depth: task.depth,
    containerId: 'board',
    subtreeIds: currentTasks.filter((entry) => entry.id === id || entry.parentTaskId === id).map((entry) => entry.id),
  };
}

function columnDrop(statusId: string) {
  return {
    kind: 'board-column',
    columnId: `status:${statusId}`,
    collectionId,
    groupBy: 'status',
    containerId: `board:${statusId}`,
  } as const;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Harness() {
  useBoardDrag({
    tasks: currentTasks,
    boardOrder: currentBoardOrder,
    groupBy: 'status',
    collectionId,
    statuses,
    sections,
    completionStatusId: doneStatusId,
    setTasks: (updater) => {
      currentTasks = updater(currentTasks);
    },
    setBoardOrder: (updater) => {
      currentBoardOrder = updater(currentBoardOrder);
    },
    onMoved,
  });
  return null;
}

const onMoved = vi.fn();

beforeEach(() => {
  handlers.onDragStart = undefined;
  handlers.onDragOver = undefined;
  handlers.onDragEnd = undefined;
  handlers.onDragCancel = undefined;
  setOverlay.mockClear();
  announce.mockClear();
  moveTask.mockReset();
  onMoved.mockClear();
  currentTasks = [
    task({ id: 'todo-a', title: 'Todo A', statusId: 'todo', orderValue: 0 }),
    task({ id: 'todo-child', title: 'Todo Child', statusId: 'todo', parentTaskId: 'todo-a', depth: 1, orderValue: 100 }),
    task({ id: 'done-a', title: 'Done A', statusId: doneStatusId, isCompleted: true, completedAt: '2026-08-14T00:00:00Z', orderValue: 0 }),
  ];
  currentBoardOrder = {
    status: { 'todo-a': 0, 'todo-child': 100, 'done-a': 0 },
    priority: {},
  };
});

describe('useBoardDrag', () => {
  it('applies the optimistic move immediately and reconciles from the response', async () => {
    const first = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    moveTask.mockReturnValueOnce(first.promise as never);

    render(<Harness />);

    const active = { id: 'todo-a', data: { current: dragData('todo-a') } };
    const over = { id: 'done', data: { current: columnDrop(doneStatusId) } };

    await act(async () => {
      handlers.onDragStart?.({ active } as never);
      handlers.onDragOver?.({ active, over } as never);
      handlers.onDragEnd?.({ active, over } as never);
    });

    expect(setOverlay).toHaveBeenCalledWith({ title: 'Todo A', descendantCount: 1 });
    expect(announce).toHaveBeenCalledWith('Picked up Todo A.');
    expect(announce).toHaveBeenCalledWith('Drop to move to Completed.');
    expect(currentTasks.find((task) => task.id === 'todo-a')?.isCompleted).toBe(true);
    expect(currentTasks.find((task) => task.id === 'todo-child')?.isCompleted).toBe(true);
    expect(moveTask).toHaveBeenCalledWith('todo-a', expect.objectContaining({
      statusId: doneStatusId,
      scope: { kind: 'status', collectionId, statusId: doneStatusId },
      position: 1,
    }));

    await act(async () => {
      first.resolve({
        moved: [
          {
            id: 'todo-a',
            parentTaskId: null,
            collectionId,
            dueDate: null,
            orderValue: 5000,
            depth: 0,
            statusId: doneStatusId,
            priority: 4,
            isCompleted: true,
          },
        ],
        reordered: [],
      });
    });

    expect(currentBoardOrder.status['todo-a']).toBe(5000);
    expect(announce).toHaveBeenCalledWith('Moved to Completed.');
    expect(onMoved).toHaveBeenCalled();
  });
});
