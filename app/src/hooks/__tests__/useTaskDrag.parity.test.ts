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
        const preview = projectMove(rows, activeId, overId, steps * INDENT_WIDTH);

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
        // Position parity, alongside depth/parentTaskId. For these same-day
        // cases `scopedRows` inside resolveMove is structurally identical to
        // the `rows` this preview call uses, so this specific assertion holds
        // regardless of whether the underlying formula is correct - it is not
        // on its own a regression guard for the drop-position bug. The
        // dedicated case below ('position parity survives...') is the one
        // built to actually distinguish the fixed formula from the old one.
        expect(commit!.input.position).toBe(preview.position);
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

describe('useTaskDrag: position parity survives when the commit scope carries a row the preview never sees', () => {
  // 'p' has a real child 'p1' due on a *different* day than 'p' itself.
  // TaskList's own preview never renders 'p1' at all (it only ever sees its
  // own day's rows), but resolveMove's `scopedRows` legitimately pulls 'p1'
  // in via `active.subtreeIds` - dropping it would fragment the block being
  // dragged. That makes the row list `resolveMove` projects against bigger,
  // by one row, than the row list this test's standalone preview call uses -
  // which is exactly the condition the "position parity" assertion above
  // cannot exercise, since there every list preview and commit project
  // against is identical.
  //
  // Dragging 'p' (earlier in the list) onto 'n' (later) is the bug's shape.
  // Reverting `resolveAt` to the old `Math.max(0, Math.min(overIndex,
  // rest.length))` math reproduces the original bug here: with 'tail' after
  // 'n' so neither call saturates against its own list length, the extra
  // 'p1' row inflates commit's pre-removal index by one without inflating
  // `rest.length` by a matching amount (its own row is absorbed into the
  // removed block instead), so old-code preview computes position 2 while
  // old-code commit computes position 3 - they disagree. The id-based fix
  // resolves both to 1: 'p' lands directly after 'mid' and ahead of 'n' by
  // finding 'n' wherever it actually sits post-removal, regardless of how
  // many extra rows preceded it pre-removal.
  const day2 = '2026-07-19';
  const positionTasks: Task[] = [
    task('p', day2, 1000),
    task('p1', '2026-07-18', 1100, 'p'),
    task('mid', day2, 1500),
    task('n', day2, 2000),
    task('tail', day2, 2500),
  ];
  const everyDate2 = flattenTasks(positionTasks);
  const rows2 = flattenTasks(positionTasks.filter((t) => t.dueDate === day2));

  it('matches the commit position even though scopedRows carries a row the preview list omits', () => {
    const preview = projectMove(rows2, 'p', 'n', 0);

    const commit = resolveMove({
      rows: everyDate2,
      active: dragData('p', day2, ['p', 'p1']),
      over: dragData('n', day2, ['n']),
      offsetX: 0,
      scope: { kind: 'day', dueDate: day2 },
    });

    expect(commit).not.toBeNull();
    expect(commit!.input.position).toBe(preview.position);
    // Pinned, not just compared: 'p' lands right after 'mid', right before 'n'.
    expect(commit!.input.position).toBe(1);
  });
});

describe('useTaskDrag: optimistic orderValue matches the projected slot', () => {
  // `flattenTasks`/`buildSections` sort siblings by `orderValue`. Dragging 'a'
  // (1000) to land between 'b' (2000) and 'c' (3000) has to hand back an
  // `orderValue` in that gap immediately - if the moved task kept its old
  // orderValue, the very next optimistic re-sort would put it straight back
  // at the front, undoing the drop before the request even goes out.
  const day = '2026-07-19';
  const orderTasks: Task[] = [
    task('a', day, 1000),
    task('b', day, 2000),
    task('c', day, 3000),
  ];
  const rows = flattenTasks(orderTasks);

  it('lands between the two siblings it was dropped between', () => {
    const commit = resolveMove({
      rows,
      active: dragData('a', day, ['a']),
      over: dragData('c', day, ['c']),
      offsetX: 0,
      scope: { kind: 'day', dueDate: day },
    });

    expect(commit).not.toBeNull();
    expect(commit!.orderValue).toBeGreaterThan(2000);
    expect(commit!.orderValue).toBeLessThan(3000);
  });

  it('lands after every sibling when dropped on the empty day container', () => {
    const commit = resolveMove({
      rows,
      active: { kind: 'task', taskId: 'a', parentTaskId: null, collectionId: 'c1', dueDate: day, depth: 0, containerId: `day:${day}`, subtreeIds: ['a'] },
      over: { kind: 'day', date: day },
      offsetX: 0,
      scope: { kind: 'day', dueDate: day },
    });

    expect(commit).not.toBeNull();
    expect(commit!.orderValue).toBe(Number.MAX_SAFE_INTEGER);
  });
});
