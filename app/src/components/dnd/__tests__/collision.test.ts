import { describe, it, expect } from 'vitest';
import { plannerCollisionDetection } from '../collision';
import type { TaskDragData } from '../../../types/drag';

/**
 * The dragged row has to remain a candidate for itself.
 *
 * dnd-kit's sortable rests with `over === active`, which is what keeps a list
 * still until the pointer moves. Excluding the active row from its own
 * candidate list meant the nearest *other* row won from the first frame, so
 * pressing the last row in a list swapped it with the row above before the
 * pointer had travelled at all - and the only way back was Escape.
 *
 * Its descendants must still be excluded: dropping a block inside itself would
 * orphan the rows being carried.
 */

const rect = (top: number) => ({
  top,
  bottom: top + 24,
  left: 0,
  right: 200,
  width: 200,
  height: 24,
});

const dragData = (id: string, subtreeIds: string[]): TaskDragData => ({
  kind: 'task',
  taskId: id,
  parentTaskId: null,
  collectionId: 'c1',
  dueDate: null,
  depth: 0,
  containerId: 'list',
  subtreeIds,
});

const container = (id: string, top: number) => ({
  id,
  rect: { current: rect(top) },
  data: { current: dragData(id, [id]) },
  disabled: false,
  key: id,
  node: { current: null },
});

/** Ids the collision detector is willing to consider. */
function candidates(activeId: string, subtreeIds: string[], pointerY: number): string[] {
  const rows = [container('parent', 0), container('child', 24), container('other', 48)];

  const collisions = plannerCollisionDetection({
    active: {
      id: activeId,
      data: { current: dragData(activeId, subtreeIds) },
      rect: { current: { initial: rect(0), translated: rect(pointerY) } },
    },
    collisionRect: rect(pointerY),
    droppableRects: new Map(rows.map((r) => [r.id, rect(r.rect.current.top)])),
    droppableContainers: rows,
    pointerCoordinates: { x: 10, y: pointerY + 12 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

/**
 * A day section with no tasks of its own.
 *
 * `closestCenter` names a winner whenever it is given any candidate, so
 * resolving rows before containers meant a row somewhere else on the page always
 * beat the empty day the pointer was actually inside - it could never be
 * dropped on, and never previewed a landing slot.
 */
function candidatesWithEmptyDay(pointerY: number): string[] {
  const taskRow = {
    ...container('other-day-row', 0),
    data: { current: { ...dragData('other-day-row', ['other-day-row']), containerId: 'day:other' } },
  };
  const emptyDay = {
    id: 'day:empty',
    rect: { current: { top: 100, bottom: 148, left: 0, right: 200, width: 200, height: 48 } },
    data: { current: { kind: 'day', date: '2026-07-20', containerId: 'day:empty' } },
    disabled: false,
    key: 'day:empty',
    node: { current: null },
  };

  const collisions = plannerCollisionDetection({
    active: {
      id: 'dragged',
      data: { current: dragData('dragged', ['dragged']) },
      rect: { current: { initial: rect(0), translated: rect(pointerY) } },
    },
    collisionRect: rect(pointerY),
    droppableRects: new Map([
      ['other-day-row', rect(0)],
      ['day:empty', emptyDay.rect.current],
    ]),
    droppableContainers: [taskRow, emptyDay],
    pointerCoordinates: { x: 10, y: pointerY },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

describe('plannerCollisionDetection: containers with no rows', () => {
  it('offers an empty day the pointer is inside, even with rows elsewhere', () => {
    expect(candidatesWithEmptyDay(120)).toContain('day:empty');
  });

  it('still prefers a row when the pointer is not inside any container', () => {
    expect(candidatesWithEmptyDay(0)).toContain('other-day-row');
  });
});

describe('plannerCollisionDetection: the dragged row is its own target', () => {
  it('offers the dragged row itself, so a resting drag moves nothing', () => {
    // Pointer still on the row it picked up.
    expect(candidates('parent', ['parent'], 0)).toContain('parent');
  });

  it('prefers the dragged row while the pointer has not left it', () => {
    expect(candidates('parent', ['parent'], 0)[0]).toBe('parent');
  });

  it('still refuses the block being carried', () => {
    // 'child' is a descendant of the dragged 'parent': dropping there would
    // orphan it.
    expect(candidates('parent', ['parent', 'child'], 0)).not.toContain('child');
  });

  it('keeps unrelated rows available', () => {
    expect(candidates('parent', ['parent', 'child'], 48)).toContain('other');
  });
});
