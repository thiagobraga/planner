import { describe, it, expect } from 'vitest';
import { resolveMove } from '../useTaskDrag';
import { flattenTasks } from '../../utils/taskProjection';
import type { Task } from '../../components/TaskItem';
import type { TaskDragData } from '../../types/drag';

/**
 * A drag that crosses dates travels a long way vertically, and the pointer
 * drifts sideways on the way. That drift used to be read as nesting intent -
 * ~90px of it requested four levels - so a task dropped on another day landed
 * as a child of whatever row happened to sit above it, at whatever depth that
 * row permitted. A top-level parent became a child of a completed subtask.
 *
 * Landing on a new date is a coarse gesture. It puts the task on that date at
 * top level; indenting is a separate, deliberate act afterwards.
 */

const task = (partial: Partial<Task> & { id: string }): Task =>
  ({
    title: partial.id,
    priority: 4,
    isCompleted: false,
    orderValue: 0,
    type: 'task',
    ...partial,
  }) as Task;

// Ordered as Daily renders: newest date first.
const tasks: Task[] = [
  task({ id: 'faxina', dueDate: '2026-07-19', orderValue: 1000 }),
  task({ id: 'talheres', dueDate: '2026-07-19', orderValue: 1100, parentTaskId: 'faxina' }),
  task({ id: 'cuidar', dueDate: '2026-07-19', orderValue: 1500 }),
  task({ id: 'comprar', dueDate: '2026-07-18', orderValue: 2000 }),
  task({ id: 'quetiapina', dueDate: '2026-07-18', orderValue: 2100, parentTaskId: 'comprar' }),
  task({ id: 'duloxetina', dueDate: '2026-07-18', orderValue: 2200, parentTaskId: 'comprar' }),
];

const rows = flattenTasks(tasks);

const dragData = (id: string, dueDate: string, subtreeIds: string[]): TaskDragData => ({
  kind: 'task',
  taskId: id,
  parentTaskId: null,
  collectionId: 'c1',
  dueDate,
  depth: 0,
  containerId: `day:${dueDate}`,
  subtreeIds,
});

const scope = { kind: 'day', dueDate: '2026-07-19' } as const;
const active = dragData('cuidar', '2026-07-19', ['cuidar']);

describe('useTaskDrag: a drop onto another date lands top-level', () => {
  // Each of these produced a nested result before: sideways drift during the
  // drag was granted as nesting by whichever row sat above the drop.
  for (const [label, target, offsetX] of [
    ['drift onto a nested row', 'quetiapina', 240],
    ['drift onto the last child', 'duloxetina', 240],
    ['drift onto a top-level row', 'comprar', 240],
    ['mild drift', 'quetiapina', 60],
    ['no drift at all', 'quetiapina', 0],
  ] as const) {
    it(`${label}`, () => {
      const move = resolveMove({
        rows,
        active,
        over: dragData(target, '2026-07-18', [target]),
        offsetX,
        scope,
      });

      expect(move).not.toBeNull();
      expect(move!.parentTaskId).toBeNull();
      expect(move!.depth).toBe(0);
    });
  }

  it('still moves the task to the new date', () => {
    const move = resolveMove({
      rows,
      active,
      over: dragData('quetiapina', '2026-07-18', ['quetiapina']),
      offsetX: 240,
      scope,
    });

    expect(move!.input.dueDate).toBe('2026-07-18');
    expect(move!.input.parentTaskId).toBeNull();
  });

  it('leaves same-day nesting alone, where the gesture is deliberate', () => {
    // Dropping below "faxina" on its own date may still nest under it: no date
    // boundary was crossed, so horizontal intent is the user's actual intent.
    const move = resolveMove({
      rows,
      active,
      over: dragData('talheres', '2026-07-19', ['talheres']),
      offsetX: 60,
      scope,
    });

    expect(move!.parentTaskId).toBe('faxina');
    expect(move!.depth).toBe(1);
  });
});
