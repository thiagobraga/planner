import { describe, it, expect } from 'vitest';
import { resolveMove } from '../useTaskDrag';
import { flattenTasks } from '../../utils/taskProjection';
import type { Task } from '../../components/TaskItem';
import type { TaskDragData } from '../../types/drag';

/**
 * Inbox and Collections render every section's tasks in one flat array (each
 * section is just a filter over it for display), so a row-to-row drop has to
 * resolve its position against the target row's own section - not the whole
 * page - or it silently promotes the task out of its section and misplaces it
 * among unrelated siblings from a different one.
 */

const task = (partial: Partial<Task> & { id: string }): Task =>
  ({
    title: partial.id,
    priority: 4,
    isCompleted: false,
    orderValue: 0,
    type: 'task',
    collectionId: 'c1',
    ...partial,
  }) as Task;

const tasks: Task[] = [
  task({ id: 'unsectioned-1', orderValue: 500 }),
  task({ id: 'shopping-1', sectionId: 'shopping', orderValue: 1000 }),
  task({ id: 'shopping-2', sectionId: 'shopping', orderValue: 2000 }),
  task({ id: 'work-1', sectionId: 'work', orderValue: 1000 }),
  task({ id: 'work-2', sectionId: 'work', orderValue: 2000 }),
];

const rows = flattenTasks(tasks);

const dragData = (id: string, sectionId: string | null, subtreeIds: string[]): TaskDragData => ({
  kind: 'task',
  taskId: id,
  parentTaskId: null,
  collectionId: 'c1',
  sectionId,
  dueDate: null,
  depth: 0,
  containerId: sectionId ? `section:${sectionId}` : 'collection:c1',
  subtreeIds,
});

const scope = { kind: 'collection', collectionId: 'c1' } as const;

describe('useTaskDrag: section-aware task-row drops', () => {
  it('carries the target section into the move input', () => {
    const active = dragData('unsectioned-1', null, ['unsectioned-1']);
    const move = resolveMove({
      rows,
      active,
      over: dragData('work-1', 'work', ['work-1']),
      offsetX: 0,
      scope,
    });

    expect(move).not.toBeNull();
    expect(move!.input.sectionId).toBe('work');
  });

  it('resolves position among the target section alone, not the whole page', () => {
    // Dropped on "work-2" (the second row of "work"): should land at index 1
    // within "work"'s two rows, not index 4 of the five-row flat list.
    const active = dragData('unsectioned-1', null, ['unsectioned-1']);
    const move = resolveMove({
      rows,
      active,
      over: dragData('work-2', 'work', ['work-2']),
      offsetX: 0,
      scope,
    });

    expect(move!.input.position).toBe(1);
  });

  it('reordering within the same section stays scoped to that section', () => {
    const active = dragData('shopping-2', 'shopping', ['shopping-2']);
    const move = resolveMove({
      rows,
      active,
      over: dragData('shopping-1', 'shopping', ['shopping-1']),
      offsetX: 0,
      scope,
    });

    expect(move!.input.sectionId).toBe('shopping');
    expect(move!.input.position).toBe(0);
  });

  it('dropping on an unsectioned row clears the section', () => {
    const active = dragData('work-1', 'work', ['work-1']);
    const move = resolveMove({
      rows,
      active,
      over: dragData('unsectioned-1', null, ['unsectioned-1']),
      offsetX: 0,
      scope,
    });

    expect(move!.input.sectionId).toBeNull();
  });

  it('leaves sectionId out of the input on a day-scoped page (Daily has no sections)', () => {
    const dayScope = { kind: 'day', dueDate: '2026-07-19' } as const;
    const active: TaskDragData = { ...dragData('work-1', 'work', ['work-1']), dueDate: '2026-07-19' };
    const over: TaskDragData = { ...dragData('work-2', 'work', ['work-2']), dueDate: '2026-07-19' };

    const move = resolveMove({ rows, active, over, offsetX: 0, scope: dayScope });

    expect(move!.input.sectionId).toBeUndefined();
  });
});
