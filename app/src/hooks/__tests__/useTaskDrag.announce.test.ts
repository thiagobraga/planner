import { describe, it, expect } from 'vitest';
import { resolveMove } from '../useTaskDrag';
import { flattenTasks } from '../../utils/taskProjection';
import type { Task } from '../../components/TaskItem';
import type { TaskDragData } from '../../types/drag';

/**
 * A screen-reader user never sees the drag overlay, so the projected target has
 * to be spoken while the row hovers it. These lock the wording of that preview:
 * present tense (the move has not happened yet) and naming the target, never an
 * id. dnd-kit's own announcements are suppressed in PlannerDragProvider
 * precisely because they leak raw UUIDs, so these strings are the only voice.
 */

const tasks: Task[] = [
  { id: 'a', title: 'Alpha', priority: 4, isCompleted: false, orderValue: 0, type: 'task' },
  { id: 'b', title: 'Bravo', priority: 4, isCompleted: false, orderValue: 1000, type: 'task' },
  { id: 'c', title: 'Charlie', priority: 4, isCompleted: false, orderValue: 2000, type: 'task' },
];

const rows = flattenTasks(tasks);

const active: TaskDragData = {
  kind: 'task',
  taskId: 'a',
  subtreeIds: ['a'],
  indent: 0,
};

const scope = { kind: 'collection', collectionId: 'c1' } as const;

describe('useTaskDrag: projected-target announcements', () => {
  it('names the collection rather than its id', () => {
    const move = resolveMove({
      rows,
      active,
      over: { kind: 'collection', collectionId: 'c9', parentId: null, isInbox: false },
      offsetX: 0,
      scope,
    });

    expect(move?.preview).toBe('Drop to file in this collection.');
    expect(move?.preview).not.toMatch(/c9/);
  });

  it('names the date when dropping on a day section', () => {
    const move = resolveMove({
      rows,
      active,
      over: { kind: 'day', date: '2026-07-19' },
      offsetX: 0,
      scope,
    });

    expect(move?.preview).toBe('Drop to move to 2026-07-19.');
  });

  it('speaks the parent title when the projection nests the row', () => {
    // Landing on Bravo's slot puts Alpha directly above, so a rightward offset
    // past one indent step is what makes Alpha the parent.
    const move = resolveMove({
      rows,
      active: { ...active, taskId: 'c', subtreeIds: ['c'] },
      over: { kind: 'task', taskId: 'b', subtreeIds: ['b'], indent: 0 },
      offsetX: 60,
      scope,
    });

    expect(move?.preview).toBe('Drop to place under Alpha.');
    expect(move?.preview).not.toMatch(/\b[0-9a-f-]{8,}\b/);
  });

  it('says top level when the projection does not nest', () => {
    const move = resolveMove({
      rows,
      active: { ...active, taskId: 'c', subtreeIds: ['c'] },
      over: { kind: 'task', taskId: 'b', subtreeIds: ['b'], indent: 0 },
      offsetX: 0,
      scope,
    });

    expect(move?.preview).toBe('Drop to place at top level.');
  });

  it('is present tense, so it never reads as an already-committed move', () => {
    const move = resolveMove({
      rows,
      active,
      over: { kind: 'day', date: '2026-07-19' },
      offsetX: 0,
      scope,
    });

    expect(move?.preview.startsWith('Drop to ')).toBe(true);
    expect(move?.announcement.startsWith('Moved ')).toBe(true);
  });

  it('refuses a drop onto the row being dragged', () => {
    const move = resolveMove({
      rows,
      active,
      over: { kind: 'task', taskId: 'a', subtreeIds: ['a'], indent: 0 },
      offsetX: 0,
      scope,
    });

    expect(move).toBeNull();
  });
});
