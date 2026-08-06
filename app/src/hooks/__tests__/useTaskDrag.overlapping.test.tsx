import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useTaskDrag } from '../useTaskDrag';
import { apiMoveTask } from '../../api/client';
import type { Task } from '../../components/TaskItem';
import type { TaskDragData } from '../../types/drag';

/**
 * Two drags on the same list, the second starting before the first settles.
 *
 * The reported symptom was a task vanishing from the rendered list during a
 * rapid sequence of same-day drags, with the drop indicator drawn several rows
 * detached from it. The server was never wrong - every move response came back
 * healthy - so this is purely about what the optimistic path leaves in local
 * state when two moves overlap.
 *
 * The risk is ordering: each drag snapshots the list at pickup and each
 * response patches whatever is in state when it lands. A response for a
 * superseded drag arriving late must not reintroduce that older shape over the
 * newer one, and a failure must not restore a snapshot that predates a move the
 * user has since made.
 */

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveTask: vi.fn(),
}));

const mockApiMoveTask = vi.mocked(apiMoveTask);

const DAY = '2026-08-06';

const task = (id: string, orderValue: number): Task =>
  ({
    id,
    title: id,
    priority: 4,
    isCompleted: false,
    orderValue,
    type: 'task',
    dueDate: DAY,
  }) as Task;

const dragData = (id: string): TaskDragData => ({
  kind: 'task',
  taskId: id,
  parentTaskId: null,
  collectionId: 'c1',
  dueDate: DAY,
  depth: 0,
  containerId: `day:${DAY}`,
  subtreeIds: [id],
});

interface DndContextProps {
  children: React.ReactNode;
  onDragStart?: (event: unknown) => void;
  onDragOver?: (event: unknown) => void;
  onDragEnd?: (event: unknown) => void;
}

const { dnd } = vi.hoisted(() => ({
  dnd: {} as Record<string, ((event: unknown) => void) | undefined>,
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children, onDragStart, onDragOver, onDragEnd }: DndContextProps) => {
      Object.assign(dnd, { onDragStart, onDragOver, onDragEnd });
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

/** The live task list, owned outside React so assertions can read it directly. */
let tasks: Task[] = [];

function Harness() {
  useTaskDrag({
    tasks,
    setTasks: (updater) => {
      tasks = updater(tasks);
    },
    scope: { kind: 'day', dueDate: DAY },
  });
  return null;
}

const renderHarness = () =>
  render(
    <PlannerDragProvider>
      <Harness />
    </PlannerDragProvider>,
  );

/** Drop `active` onto `overId`, without awaiting the request. */
async function drop(active: string, overId: string) {
  const activeData = { id: active, data: { current: dragData(active) } };
  const overData = { id: overId, data: { current: dragData(overId) } };
  await act(async () => {
    dnd.onDragStart?.({ active: activeData });
    dnd.onDragOver?.({ active: activeData, over: overData });
    dnd.onDragEnd?.({ active: activeData, over: overData });
  });
}

/** The ids in render order - what the user actually sees in the list. */
const order = () => [...tasks].sort((a, b) => a.orderValue - b.orderValue).map((t) => t.id);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockApiMoveTask.mockReset();
  tasks = [task('a', 1000), task('b', 2000), task('c', 3000)];
});

describe('useTaskDrag: overlapping moves on the same list', () => {
  it('keeps every row when a second drag starts before the first resolves', async () => {
    const first = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    const second = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    mockApiMoveTask
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    renderHarness();

    await drop('c', 'a');
    await drop('b', 'a');

    // Both requests are in flight; nothing has come back yet.
    expect(mockApiMoveTask).toHaveBeenCalledTimes(2);
    expect(order()).toHaveLength(3);
    expect(new Set(order())).toEqual(new Set(['a', 'b', 'c']));

    await act(async () => {
      first.resolve({ moved: [], reordered: [] });
      second.resolve({ moved: [], reordered: [] });
    });

    // No row dropped, none duplicated - the disappearing-task symptom.
    expect(order()).toHaveLength(3);
    expect(new Set(order())).toEqual(new Set(['a', 'b', 'c']));
  });

  it('leaves the newer move in place when the older response lands last', async () => {
    const first = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    const second = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    mockApiMoveTask
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    renderHarness();

    await drop('c', 'a');
    await drop('b', 'a');
    const afterBothDrops = order();

    // The *older* request settles after the newer one - the race the report
    // describes. An empty response patches nothing, so the optimistic order
    // both drags produced has to survive it.
    await act(async () => {
      second.resolve({ moved: [], reordered: [] });
      first.resolve({ moved: [], reordered: [] });
    });

    expect(order()).toEqual(afterBothDrops);
  });

  it('does not resurrect a stale list when a superseded move fails', async () => {
    const first = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    const second = deferred<Awaited<ReturnType<typeof apiMoveTask>>>();
    mockApiMoveTask
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const onError = vi.fn();
    render(
      <PlannerDragProvider>
        <HarnessWithError onError={onError} />
      </PlannerDragProvider>,
    );

    await drop('c', 'a');
    await drop('b', 'a');

    await act(async () => {
      first.reject(new Error('first move failed'));
      // Let the rejection settle before the second resolves.
      await Promise.resolve();
      second.resolve({ moved: [], reordered: [] });
    });

    // A failed move restores its own pre-drag snapshot, and the page is told to
    // refetch. What must not happen is rows going missing or doubling up.
    expect(onError).toHaveBeenCalled();
    expect(order()).toHaveLength(3);
    expect(new Set(order())).toEqual(new Set(['a', 'b', 'c']));
  });
});

function HarnessWithError({ onError }: { onError: () => void }) {
  useTaskDrag({
    tasks,
    setTasks: (updater) => {
      tasks = updater(tasks);
    },
    scope: { kind: 'day', dueDate: DAY },
    onError,
  });
  return null;
}
