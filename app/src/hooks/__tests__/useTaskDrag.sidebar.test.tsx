import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useTaskDrag } from '../useTaskDrag';
import { apiMoveTask } from '../../api/client';
import type { Task } from '../../components/TaskItem';
import type { CollectionDropData, TaskDragData } from '../../types/drag';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveTask: vi.fn(),
}));

const moveTask = vi.mocked(apiMoveTask);

/** Captures the handler the provider registers, the way dnd-kit would call it. */
let registered: ((event: DragEndEvent) => void) | null = null;

vi.mock('../../contexts/PlannerDragContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/PlannerDragContext')>();
  return {
    ...actual,
    usePlannerDragHandlers: (_kind: string, handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
      registered = handlers.onDragEnd ?? registered;
    },
  };
});

const HOME = 'collection-home';

const tasks: Task[] = [
  { id: 'root', title: 'Root', priority: 4, isCompleted: false, orderValue: 0, type: 'task', collectionId: HOME, indent: 0 },
  { id: 'child', title: 'Child', priority: 4, isCompleted: false, orderValue: 1000, type: 'task', collectionId: HOME, indent: 1, parentTaskId: 'root' },
];

function taskDrag(over: Partial<TaskDragData> = {}): TaskDragData {
  return {
    kind: 'task',
    taskId: 'root',
    parentTaskId: null,
    collectionId: HOME,
    dueDate: '2026-07-18',
    depth: 0,
    containerId: HOME,
    subtreeIds: ['root', 'child'],
    ...over,
  };
}

function collectionDrop(over: Partial<CollectionDropData> = {}): CollectionDropData {
  return { kind: 'collection', collectionId: 'collection-work', isInbox: false, parentId: null, ...over };
}

function mount(onMoved?: () => void) {
  const emitted: Task[][] = [];
  function Harness() {
    useTaskDrag({
      tasks,
      setTasks: (updater) => emitted.push(updater(tasks)),
      scope: { kind: 'collection', collectionId: HOME },
      onMoved,
    });
    return null;
  }
  render(
    <PlannerDragProvider>
      <Harness />
    </PlannerDragProvider>,
  );
  return emitted;
}

function drop(active: TaskDragData, over: CollectionDropData | TaskDragData | null) {
  act(() => {
    registered?.({
      active: { id: active.taskId, data: { current: active } },
      over: over ? { id: 'target', data: { current: over } } : null,
    } as unknown as DragEndEvent);
  });
}

beforeEach(() => {
  registered = null;
  moveTask.mockReset();
  moveTask.mockResolvedValue({ moved: [], reordered: [] } as never);
});

describe('dropping a task on a sidebar collection', () => {
  it('files it into a named collection, appended at top level', () => {
    mount();
    drop(taskDrag(), collectionDrop());

    expect(moveTask).toHaveBeenCalledWith('root', {
      parentTaskId: null,
      collectionId: 'collection-work',
      scope: { kind: 'collection', collectionId: 'collection-work' },
      position: Number.MAX_SAFE_INTEGER,
    });
  });

  it('treats a sub-collection exactly like a root collection', () => {
    mount();
    drop(taskDrag(), collectionDrop({ collectionId: 'collection-sub', parentId: 'collection-work' }));

    expect(moveTask).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({ collectionId: 'collection-sub', parentTaskId: null }),
    );
  });

  it('files into Inbox through the same top-level append', () => {
    mount();
    drop(taskDrag(), collectionDrop({ collectionId: 'collection-inbox', isInbox: true }));

    expect(moveTask).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({ collectionId: 'collection-inbox', parentTaskId: null }),
    );
  });

  it('never sends a due date, so a dated task keeps its day', () => {
    mount();
    drop(taskDrag(), collectionDrop());

    expect(moveTask.mock.calls[0]![1]).not.toHaveProperty('dueDate');
  });

  it('promotes a subtask dropped on the collection it already lives in', () => {
    mount();
    drop(
      taskDrag({ taskId: 'child', parentTaskId: 'root', depth: 1, subtreeIds: ['child'] }),
      collectionDrop({ collectionId: HOME }),
    );

    // Same collection, but no longer a subtask: it becomes a top-level row.
    expect(moveTask).toHaveBeenCalledWith(
      'child',
      expect.objectContaining({ collectionId: HOME, parentTaskId: null }),
    );
  });

  it('applies the promotion optimistically before the server answers', () => {
    const emitted = mount();
    drop(
      taskDrag({ taskId: 'child', parentTaskId: 'root', depth: 1, subtreeIds: ['child'] }),
      collectionDrop({ collectionId: 'collection-work' }),
    );

    const moved = emitted[0]?.find((t) => t.id === 'child');
    expect(moved?.parentTaskId).toBeUndefined();
    expect(moved?.indent).toBe(0);
    expect(moved?.collectionId).toBe('collection-work');
  });

  it('invalidates the other views once the move succeeds', async () => {
    const onMoved = vi.fn();
    mount(onMoved);
    drop(taskDrag(), collectionDrop());

    await waitFor(() => expect(onMoved).toHaveBeenCalled());
  });

  it('does nothing when released over no target at all', () => {
    mount();
    drop(taskDrag(), null);

    expect(moveTask).not.toHaveBeenCalled();
  });

  it('refuses to move a row the server has never seen', () => {
    mount();
    drop(taskDrag({ taskId: 'temp-123', subtreeIds: ['temp-123'] }), collectionDrop());

    expect(moveTask).not.toHaveBeenCalled();
  });
});
