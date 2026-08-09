import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { usePlannerDrag, INDENT_PX } from '../../contexts/usePlannerDrag';
import { useTaskDrag } from '../useTaskDrag';
import { apiMoveTask } from '../../api/client';
import type { Task } from '../../components/TaskItem';
import type { TaskDragData } from '../../types/drag';

/**
 * The indent the preview draws and the parent the drop commits must agree.
 *
 * They used to come from two separately-instantiated `IndentTracker`s - one in
 * `PlannerDragProvider` feeding `indentSteps` (what `TaskList` renders the
 * preview from), one inside `useTaskDrag` feeding `offsetX` (what `resolveMove`
 * commits from). Two pieces of mutable state updated independently from the
 * same event stream is a standing invitation to disagree, and they did: the
 * list previewed a task nesting under its sibling while the request went out
 * with `parentTaskId: null`, so the drop visibly did nothing.
 *
 * These drive the real provider and the real hook together, so the preview
 * value and the committed value are both read from whatever the production
 * wiring actually produces.
 */

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveTask: vi.fn(),
}));

const mockApiMoveTask = vi.mocked(apiMoveTask);

const DAY = '2026-08-06';

const task = (id: string, orderValue: number, parentTaskId?: string): Task =>
  ({
    id,
    title: id,
    priority: 4,
    isCompleted: false,
    orderValue,
    type: 'task',
    dueDate: DAY,
    parentTaskId,
  }) as Task;

const dragData = (id: string, subtreeIds: string[] = [id]): TaskDragData => ({
  kind: 'task',
  taskId: id,
  parentTaskId: null,
  collectionId: 'c1',
  dueDate: DAY,
  depth: 0,
  containerId: `day:${DAY}`,
  subtreeIds,
});

interface DndContextProps {
  children: React.ReactNode;
  onDragStart?: (event: unknown) => void;
  onDragMove?: (event: unknown) => void;
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
    DndContext: ({ children, onDragStart, onDragMove, onDragOver, onDragEnd }: DndContextProps) => {
      Object.assign(dnd, { onDragStart, onDragMove, onDragOver, onDragEnd });
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

/** The preview value `TaskList` would render its projected depth from. */
let previewSteps = 0;

function Harness({ tasks }: { tasks: Task[] }) {
  const { indentSteps } = usePlannerDrag();
  previewSteps = indentSteps;
  useTaskDrag({
    tasks,
    setTasks: () => {},
    scope: { kind: 'day', dueDate: DAY },
  });
  return null;
}

const renderHarness = (tasks: Task[]) =>
  render(
    <PlannerDragProvider>
      <Harness tasks={tasks} />
    </PlannerDragProvider>,
  );

/**
 * Drive one complete gesture: pick `active` up, drag `deltaX` sideways, hover
 * `overId`, release. Mirrors the order dnd-kit fires these in.
 */
async function drag({
  active,
  overId,
  deltaX,
  subtreeIds,
}: {
  active: string;
  overId: string;
  deltaX: number;
  subtreeIds?: string[];
}) {
  const activeData = { id: active, data: { current: dragData(active, subtreeIds) } };
  const overData = { id: overId, data: { current: dragData(overId) } };

  // Split from the drop, so `previewSteps` can be read at the moment the user
  // would see the preview - after React has committed the hover render, before
  // the release resets it to zero.
  await act(async () => {
    dnd.onDragStart?.({ active: activeData });
    // Reaching the row first, then travelling sideways on it - the provider
    // rebases nesting intent per row, so the order matters.
    dnd.onDragOver?.({ active: activeData, over: overData });
    dnd.onDragMove?.({ active: activeData, over: overData, delta: { x: deltaX, y: 0 } });
  });

  const stepsAtDrop = previewSteps;

  await act(async () => {
    dnd.onDragEnd?.({ active: activeData, over: overData });
  });

  return stepsAtDrop;
}

beforeEach(() => {
  mockApiMoveTask.mockReset();
  mockApiMoveTask.mockResolvedValue({ moved: [], reordered: [] } as Awaited<
    ReturnType<typeof apiMoveTask>
  >);
  previewSteps = 0;
});

describe('useTaskDrag: the committed parent matches the previewed indent', () => {
  // Dropping *on* a row inserts before it, so nesting under 'a' means dragging
  // 'c' onto 'b': the row above the landing slot is then 'a', and one step of
  // horizontal offset makes 'a' the parent. (Dragging onto 'a' itself lands at
  // the top of the list, where there is no row above and no parent is possible
  // at any offset - `projectMove` clamps depth to 0 there.)
  const tasks = [task('a', 1000), task('b', 2000), task('c', 3000)];

  it('commits a parent when the preview shows one indent step', async () => {
    renderHarness(tasks);

    const stepsAtDrop = await drag({ active: 'c', overId: 'b', deltaX: INDENT_PX });

    expect(stepsAtDrop).toBe(1);
    expect(mockApiMoveTask).toHaveBeenCalledTimes(1);
    expect(mockApiMoveTask.mock.calls[0][1].parentTaskId).toBe('a');
  });

  it('commits no parent when the preview shows no indent', async () => {
    renderHarness(tasks);

    const stepsAtDrop = await drag({ active: 'c', overId: 'b', deltaX: 0 });

    expect(stepsAtDrop).toBe(0);
    expect(mockApiMoveTask.mock.calls[0][1].parentTaskId).toBeNull();
  });

  /**
   * The case the two trackers disagreed on most readily.
   *
   * A sub-step drag (less than half an indent) rounds to zero steps, so the
   * preview stays flush. The commit read the *raw* pixel offset, so anything
   * `projectMove` treated as past its own threshold could still parent the row
   * - a preview of "no nesting" committing a parent, or the reverse. Both sides
   * now round identically.
   */
  it('agrees with the preview for an offset that rounds down to no indent', async () => {
    renderHarness(tasks);

    const stepsAtDrop = await drag({ active: 'c', overId: 'b', deltaX: Math.floor(INDENT_PX / 2) - 1 });

    expect(stepsAtDrop).toBe(0);
    expect(mockApiMoveTask.mock.calls[0][1].parentTaskId).toBeNull();
  });

  it('agrees with the preview for an offset that rounds up to one indent', async () => {
    renderHarness(tasks);

    const stepsAtDrop = await drag({ active: 'c', overId: 'b', deltaX: INDENT_PX - 1 });

    expect(stepsAtDrop).toBe(1);
    expect(mockApiMoveTask.mock.calls[0][1].parentTaskId).toBe('a');
  });

  /**
   * Sideways drift on the way to a row is not nesting intent.
   *
   * The provider rebases on each newly hovered row. If the hook had kept its
   * own tracker, only one of the two would have been rebased by this sequence.
   */
  it('ignores horizontal travel made before reaching the hovered row', async () => {
    renderHarness(tasks);

    const activeData = { id: 'c', data: { current: dragData('c') } };
    const overA = { id: 'b', data: { current: dragData('b') } };

    await act(async () => {
      dnd.onDragStart?.({ active: activeData });
      // Drift sideways while still over its own row...
      dnd.onDragMove?.({ active: activeData, delta: { x: 3 * INDENT_PX, y: 0 } });
      // ...then arrive on 'a', which rebases intent to zero.
      dnd.onDragOver?.({ active: activeData, over: overA });
    });

    // Read before the drop, which resets the preview to zero either way.
    const stepsAtDrop = previewSteps;
    await act(async () => {
      dnd.onDragEnd?.({ active: activeData, over: overA });
    });

    expect(stepsAtDrop).toBe(0);
    expect(mockApiMoveTask.mock.calls[0][1].parentTaskId).toBeNull();
  });
});
