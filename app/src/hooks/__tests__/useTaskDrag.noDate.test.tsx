import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useTaskDrag } from '../useTaskDrag';
import { apiMoveTask } from '../../api/client';
import type { Task } from '../../components/TaskItem';
import type { NoDateDropData, TaskDragData } from '../../types/drag';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveTask: vi.fn(),
}));

const moveTask = vi.mocked(apiMoveTask);

let registered: ((event: DragEndEvent) => void) | null = null;

vi.mock('../../contexts/usePlannerDrag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/usePlannerDrag')>();
  return {
    ...actual,
    usePlannerDragHandlers: (_kind: string, handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
      registered = handlers.onDragEnd ?? registered;
    },
  };
});

const HOME = 'collection-home';

const tasks: Task[] = [
  { id: 'root', title: 'Root', priority: 4, isCompleted: false, orderValue: 0, type: 'task', collectionId: HOME, indent: 0, dueDate: '2026-09-20' },
];

function taskDrag(over: Partial<TaskDragData> = {}): TaskDragData {
  return {
    kind: 'task',
    taskId: 'root',
    parentTaskId: null,
    collectionId: HOME,
    dueDate: '2026-09-20',
    depth: 0,
    containerId: HOME,
    subtreeIds: ['root'],
    ...over,
  };
}

function noDateDrop(over: Partial<NoDateDropData> = {}): NoDateDropData {
  return { kind: 'no-date', containerId: 'no-date', ...over };
}

function mount() {
  function Harness() {
    useTaskDrag({
      tasks,
      setTasks: () => {},
      scope: { kind: 'day', dueDate: '2026-09-20' },
    });
    return null;
  }
  render(
    <PlannerDragProvider>
      <Harness />
    </PlannerDragProvider>,
  );
}

async function drop(active: TaskDragData, over: NoDateDropData | null) {
  await act(async () => {
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

describe('dropping a task on the No-date kanban column', () => {
  it('clears the due date and files it back into its own collection ordering', async () => {
    mount();
    await drop(taskDrag(), noDateDrop());

    expect(moveTask).toHaveBeenCalledWith('root', {
      parentTaskId: null,
      dueDate: null,
      scope: { kind: 'collection', collectionId: HOME },
      position: Number.MAX_SAFE_INTEGER,
    });
  });
});
