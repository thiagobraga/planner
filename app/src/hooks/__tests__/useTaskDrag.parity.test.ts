import { describe, it, expect } from 'vitest';
import { resolveMove } from '../useTaskDrag';
import { flattenTasks, projectMove, INDENT_WIDTH } from '../../utils/taskProjection';
import type { Task } from '../../components/TaskItem';
import type { TaskDragData } from '../../types/drag';

/**
 * The slot a list draws and the move that commits have to agree.
 *
 * TaskList previews from the rows of one date; the hook was projecting against
 * every rendered date flattened into a single list, so the rows either side of
 * a drop could belong to a different day. Dropping onto the last row of one
 * date read the first row of the *next* date as its neighbour: the preview said
 * top level while the commit parented the task across the date boundary - the
 * same fault that left a July task hanging off a May one in the database.
 */

const task = (id: string, dueDate: string, orderValue: number, parentTaskId?: string): Task =>
  ({
    id,
    title: id,
    priority: 4,
    isCompleted: false,
    orderValue,
    type: 'task',
    dueDate,
    parentTaskId,
  }) as Task;

// Two dates, each holding a small subtree, ordered as Daily renders them.
const tasks: Task[] = [
  task('a', '2026-07-19', 1000),
  task('a1', '2026-07-19', 1100, 'a'),
  task('b', '2026-07-19', 2000),
  task('c', '2026-07-18', 3000),
  task('c1', '2026-07-18', 3100, 'c'),
  task('d', '2026-07-18', 4000),
];

const everyDate = flattenTasks(tasks);
const oneDate = (day: string) => flattenTasks(tasks.filter((t) => t.dueDate === day));
const dateOf = (id: string | null) => tasks.find((t) => t.id === id)?.dueDate ?? null;

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

const DAY = '2026-07-19';
const cases: [string, string[], string][] = [
  ['a', ['a', 'a1'], 'b'],
  ['b', ['b'], 'a'],
  ['b', ['b'], 'a1'],
];

describe('useTaskDrag: the drop lands where the slot said it would', () => {
  for (const [activeId, subtreeIds, overId] of cases) {
    for (const steps of [0, 1, 2]) {
      it(`${activeId} onto ${overId}, ${steps} indent step(s)`, () => {
        const rows = oneDate(DAY);
        const previewIndex = rows.findIndex((r) => r.id === overId);
        const preview = projectMove(rows, activeId, previewIndex, steps * INDENT_WIDTH);

        const commit = resolveMove({
          rows: everyDate,
          active: dragData(activeId, DAY, subtreeIds),
          over: dragData(overId, DAY, [overId]),
          offsetX: steps * INDENT_WIDTH,
          scope: { kind: 'day', dueDate: DAY },
        });

        expect(commit).not.toBeNull();
        expect(commit!.depth).toBe(preview.depth);
        expect(commit!.parentTaskId).toBe(preview.parentId);
      });
    }
  }

  it('never reaches across the date boundary for a parent', () => {
    // 'b' is the last row of JUL 19; JUL 18's 'c' follows it in the flat list.
    const commit = resolveMove({
      rows: everyDate,
      active: dragData('a', DAY, ['a', 'a1']),
      over: dragData('b', DAY, ['b']),
      offsetX: 0,
      scope: { kind: 'day', dueDate: DAY },
    });

    expect(dateOf(commit!.parentTaskId)).not.toBe('2026-07-18');
  });
});
