import { render, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskList } from '../TaskList';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import type { Task } from '../TaskItem';

/**
 * A day's droppable must reach into the 24px seam below it, whether the list
 * is empty or not.
 *
 * Sections sit `mt-6` apart with nothing droppable registered in that gap. A
 * task dragged in from a date rendered further down the page crosses that
 * seam on the way to the section above it - and while the pointer is inside
 * it, no list's droppable claims the hit, so the drop fell back to plain
 * nearest-row matching and landed inserted *before* the target's last row
 * instead of appended after it ("moving Teste 2 from TUE to after Note test
 * on WED" - not possible). `.task-list--drag-target` closes that gap by
 * padding the container 24px while a drag is in flight, cancelled by an
 * equal negative margin so the page never shifts.
 */

type DragHandler = (event: unknown) => void;

interface DndContextProps {
  children: React.ReactNode;
  onDragStart?: DragHandler;
  onDragMove?: DragHandler;
  onDragEnd?: DragHandler;
  onDragCancel?: DragHandler;
}

const { dndHandlers } = vi.hoisted(() => ({
  dndHandlers: {} as Record<string, DragHandler | undefined>,
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children, onDragStart, onDragMove, onDragEnd, onDragCancel }: DndContextProps) => {
      Object.assign(dndHandlers, { onDragStart, onDragMove, onDragEnd, onDragCancel });
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const startDrag = (taskId: string, containerId: string) => {
  act(() => {
    dndHandlers.onDragStart?.({
      active: {
        id: taskId,
        data: {
          current: {
            kind: 'task',
            taskId,
            parentTaskId: null,
            collectionId: 'c1',
            dueDate: null,
            depth: 0,
            containerId,
            subtreeIds: [taskId],
          },
        },
      },
    });
  });
};

const tasks: Task[] = [
  { id: 'note-test', title: 'Note test', priority: 4, isCompleted: false, orderValue: 0, type: 'note' },
];

describe('TaskList: the droppable reaches into the gap below the section', () => {
  it('does not claim drop area while nothing is being dragged', () => {
    const { container } = render(
      <PlannerDragProvider>
        <TaskList tasks={tasks} containerId="day:wed" dayDate="2026-08-05" />
      </PlannerDragProvider>,
    );

    expect(container.querySelectorAll('.task-list--drag-target').length).toBe(0);
  });

  it('claims a 24px drop area below a populated list once a drag starts', () => {
    const { container } = render(
      <PlannerDragProvider>
        <TaskList tasks={tasks} containerId="day:wed" dayDate="2026-08-05" />
      </PlannerDragProvider>,
    );

    // A drag starting in a *different* day's list - the "Teste 2 on TUE
    // dragged toward WED" shape of the bug.
    startDrag('teste-2', 'day:tue');

    expect(container.querySelectorAll('.task-list--drag-target').length).toBe(1);
  });

  it('claims the same drop area for an empty list', () => {
    const { container } = render(
      <PlannerDragProvider>
        <TaskList tasks={[]} containerId="day:empty" dayDate="2026-08-06" />
      </PlannerDragProvider>,
    );

    startDrag('teste-2', 'day:tue');

    expect(container.querySelectorAll('.task-list--drag-target').length).toBe(1);
  });
});
