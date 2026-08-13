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

/**
 * An Inbox/Collections task section with no tasks of its own.
 *
 * `SectionDropData` is what makes a brand-new section fillable at all - a
 * task drag that never lists `'section'` among its allowed drop kinds filters
 * it out of the candidate list before any pointer geometry runs, so the empty
 * section can never win no matter where the pointer sits.
 */
function candidatesWithEmptySection(pointerY: number): string[] {
  const taskRow = {
    ...container('other-section-row', 0),
    data: { current: { ...dragData('other-section-row', ['other-section-row']), containerId: 'section:other' } },
  };
  const emptySection = {
    id: 'section:empty',
    rect: { current: { top: 100, bottom: 148, left: 0, right: 200, width: 200, height: 48 } },
    data: { current: { kind: 'section', sectionId: 'empty', collectionId: 'c1', containerId: 'section:empty' } },
    disabled: false,
    key: 'section:empty',
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
      ['other-section-row', rect(0)],
      ['section:empty', emptySection.rect.current],
    ]),
    droppableContainers: [taskRow, emptySection],
    pointerCoordinates: { x: 10, y: pointerY },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

describe('plannerCollisionDetection: an empty task section', () => {
  it('offers an empty section the pointer is inside, even with rows elsewhere', () => {
    expect(candidatesWithEmptySection(120)).toContain('section:empty');
  });

  it('still prefers a row when the pointer is not inside any section', () => {
    expect(candidatesWithEmptySection(0)).toContain('other-section-row');
  });
});

/**
 * Habit rows sit inside a section that is itself a drop target.
 *
 * The section is what makes an empty group fillable, but it must not swallow
 * drops aimed at the rows inside it: a section drop appends at depth 0, so
 * while the section kept winning, no habit could be nested under another and
 * every drop landed at the end of the list rather than where it was released.
 */
function habitCandidates(pointerY: number): string[] {
  const row = (id: string, top: number) => ({
    id,
    rect: { current: rect(top) },
    data: {
      current: {
        kind: 'habit',
        habitId: id,
        parentId: null,
        groupId: 'morning',
        containerId: 'morning',
        childIds: [],
      },
    },
    disabled: false,
    key: id,
    node: { current: null },
  });

  const section = {
    id: 'section-morning',
    rect: { current: { top: 0, bottom: 200, left: 0, right: 200, width: 200, height: 200 } },
    data: { current: { kind: 'habit-section', groupId: 'morning' } },
    disabled: false,
    key: 'section-morning',
    node: { current: null },
  };

  const collisions = plannerCollisionDetection({
    active: {
      id: 'dragged',
      data: {
        current: {
          kind: 'habit',
          habitId: 'dragged',
          parentId: null,
          groupId: 'morning',
          containerId: 'morning',
          childIds: [],
        },
      },
      rect: { current: { initial: rect(0), translated: rect(pointerY) } },
    },
    collisionRect: rect(pointerY),
    droppableRects: new Map([
      ['target', rect(24)],
      ['section-morning', section.rect.current],
    ]),
    droppableContainers: [row('target', 24), section],
    pointerCoordinates: { x: 10, y: pointerY },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

/**
 * Section headers reorder against each other, never against the `section`
 * container a task can be filed into - despite dnd-kit registering both a
 * section header (draggable + droppable, for reordering) and its empty task
 * list (droppable, for filing) at the same time. Sharing the `section` tag
 * between the two would let a task drag collide with a header row it should
 * never see, and a header drag collide with a task-only container.
 */
function sectionHeaderVsTaskCandidates(activeKind: 'task' | 'section-header'): string[] {
  const header = {
    id: 'header:a',
    rect: { current: rect(0) },
    data: { current: { kind: 'section-header', sectionId: 'a', collectionId: 'c1' } },
    disabled: false,
    key: 'header:a',
    node: { current: null },
  };
  const otherHeader = {
    id: 'header:b',
    rect: { current: rect(24) },
    data: { current: { kind: 'section-header', sectionId: 'b', collectionId: 'c1' } },
    disabled: false,
    key: 'header:b',
    node: { current: null },
  };
  const taskRow = { ...container('sibling-task', 0), data: { current: dragData('sibling-task', ['sibling-task']) } };

  const active =
    activeKind === 'task'
      ? { id: 'dragged-task', data: { current: dragData('dragged-task', ['dragged-task']) } }
      : { id: 'header:a', data: { current: header.data.current } };

  const collisions = plannerCollisionDetection({
    active: {
      ...active,
      rect: { current: { initial: rect(0), translated: rect(0) } },
    },
    collisionRect: rect(0),
    droppableRects: new Map([
      ['sibling-task', rect(0)],
      ['header:a', rect(0)],
      ['header:b', rect(24)],
    ]),
    droppableContainers: [taskRow, header, otherHeader],
    pointerCoordinates: { x: 10, y: 12 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

describe('plannerCollisionDetection: section headers reorder only against each other', () => {
  it('a task drag never collides with a section header row', () => {
    expect(sectionHeaderVsTaskCandidates('task')).not.toContain('header:a');
    expect(sectionHeaderVsTaskCandidates('task')).not.toContain('header:b');
  });

  it('a section header drag never collides with a task row', () => {
    expect(sectionHeaderVsTaskCandidates('section-header')).not.toContain('sibling-task');
  });

  it('a section header drag still finds the other header to reorder against', () => {
    expect(sectionHeaderVsTaskCandidates('section-header')).toContain('header:b');
  });
});

describe('plannerCollisionDetection: habit rows inside a section', () => {
  it('prefers the row the pointer is over to the section holding it', () => {
    expect(habitCandidates(30)[0]).toBe('target');
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

describe('plannerCollisionDetection: nested board containers', () => {
  it('prefers a card subtask row over the column that contains it', () => {
    const outer = {
      id: 'column',
      rect: { current: { top: 0, bottom: 200, left: 0, right: 240, width: 240, height: 200 } },
      data: { current: { kind: 'board-column', columnId: 'status:todo', collectionId: 'c1', groupBy: 'status', containerId: 'status:todo' } },
      disabled: false, key: 'column', node: { current: null },
    };
    const nested = {
      id: 'subtasks',
      rect: { current: { top: 48, bottom: 120, left: 12, right: 228, width: 216, height: 72 } },
      data: { current: { kind: 'card-subtasks', taskId: 'parent', collectionId: 'c1' } },
      disabled: false, key: 'subtasks', node: { current: null },
    };
    const columnRow = {
      ...container('column-card', 48),
      data: { current: { ...dragData('column-card', ['column-card']), containerId: 'status:todo' } },
    };
    const subtaskRow = {
      ...container('child', 72),
      data: { current: { ...dragData('child', ['child']), containerId: 'card:parent' } },
    };

    const collisions = plannerCollisionDetection({
      active: {
        id: 'dragged',
        data: { current: { ...dragData('dragged', ['dragged']), containerId: 'status:backlog' } },
        rect: { current: { initial: rect(0), translated: rect(72) } },
      },
      collisionRect: rect(72),
      droppableRects: new Map([
        ['column', outer.rect.current], ['subtasks', nested.rect.current],
        ['column-card', rect(48)], ['child', rect(72)],
      ]),
      droppableContainers: [outer, nested, columnRow, subtaskRow],
      pointerCoordinates: { x: 100, y: 84 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(collisions[0]?.id).toBe('subtasks');
    expect(collisions[0]?.id).not.toBe('column');
  });
});

/**
 * A drop arriving from a different day, aimed at the end of a short list.
 *
 * Dragging in from below (a source day rendered lower on the page) reaches a
 * short target list's last row well before the pointer travels past that
 * row's own midpoint - the row is often the very first thing the drag
 * touches. Requiring the stricter past-center threshold there resolved the
 * drop as "insert before the last row" instead of "append", which is the
 * "moving to last not working" bug: a task dragged from AUG 04 onto TODAY,
 * aimed past TODAY's last row, landed one slot short of the end.
 */
function crossDayLastRowCandidates(pointerY: number, activeContainerId: string): string[] {
  const targetDay = {
    id: 'day:today',
    rect: { current: { top: 0, bottom: 48, left: 0, right: 200, width: 200, height: 48 } },
    data: { current: { kind: 'day', date: '2026-08-05', containerId: 'day:today' } },
    disabled: false,
    key: 'day:today',
    node: { current: null },
  };
  const taskRow = (id: string, top: number, containerId: string) => ({
    id,
    rect: { current: rect(top) },
    data: {
      current: {
        kind: 'task',
        taskId: id,
        parentTaskId: null,
        collectionId: 'c1',
        dueDate: null,
        depth: 0,
        containerId,
        subtreeIds: [id],
      },
    },
    disabled: false,
    key: id,
    node: { current: null },
  });
  const test = taskRow('test', 0, 'day:today');
  const fix = taskRow('fix', 24, 'day:today');

  const collisions = plannerCollisionDetection({
    active: {
      id: 'dragged',
      data: {
        current: {
          kind: 'task',
          taskId: 'dragged',
          parentTaskId: null,
          collectionId: 'c1',
          dueDate: null,
          depth: 0,
          containerId: activeContainerId,
          subtreeIds: ['dragged'],
        },
      },
      rect: { current: { initial: rect(0), translated: rect(pointerY) } },
    },
    collisionRect: rect(pointerY),
    droppableRects: new Map([
      ['test', rect(0)],
      ['fix', rect(24)],
      ['day:today', targetDay.rect.current],
    ]),
    droppableContainers: [test, fix, targetDay],
    pointerCoordinates: { x: 10, y: pointerY },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

describe('plannerCollisionDetection: cross-day drop aimed at the end of a short list', () => {
  // 'fix' is the last row, spanning y 24-48; its center sits at y 36.
  it('appends past the last row for a foreign drag, even before its midpoint', () => {
    // Upper half of 'fix' (y=28): a same-list drag would still resolve to
    // 'fix' here (insert before it), but this drag started in a different
    // day, so it reads as "add to the end" instead.
    expect(crossDayLastRowCandidates(28, 'day:2026-08-04')).toContain('day:today');
  });

  it('still resolves to the last row directly for a same-list drag', () => {
    // Same pointer position, but the drag started in this list - reordering
    // within a list must still be able to target "just before the last row"
    // by hovering it.
    expect(crossDayLastRowCandidates(28, 'day:today')).toContain('fix');
    expect(crossDayLastRowCandidates(28, 'day:today')).not.toContain('day:today');
  });

  it('appends for a foreign drag once the pointer does cross the midpoint too', () => {
    expect(crossDayLastRowCandidates(40, 'day:2026-08-04')).toContain('day:today');
  });
});

/**
 * The same drop, into a day holding exactly *one* task.
 *
 * The reported repro: today has a single row, a task is dragged in from another
 * day and aimed below it, and it landed above instead. This is the shape the
 * cases above miss - there the last row has a sibling above it, so the pointer
 * has somewhere to be that is unambiguously "past a row". With one row the
 * whole list is its last row, and the only space below it is the 24px seam the
 * container's padding claims.
 *
 * That padding is exactly what `MeasuringStrategy.BeforeDragging` failed to see
 * while it was applied by a drag-conditional class: dnd-kit measures each
 * droppable once at drag start, before React has committed the class, so the
 * container rect stopped at the row and `pointerWithin` found nothing to append
 * to. The `containerBottom` argument below is what that measured rect's bottom
 * edge is - the whole point of the fix is that it now includes the padding.
 */
function singleRowDayCandidates(pointerY: number, containerBottom: number): string[] {
  const targetDay = {
    id: 'day:today',
    rect: {
      current: { top: 0, bottom: containerBottom, left: 0, right: 200, width: 200, height: containerBottom },
    },
    data: { current: { kind: 'day', date: '2026-08-06', containerId: 'day:today' } },
    disabled: false,
    key: 'day:today',
    node: { current: null },
  };
  const only = {
    id: 'only',
    rect: { current: rect(0) },
    data: {
      current: {
        kind: 'task',
        taskId: 'only',
        parentTaskId: null,
        collectionId: 'c1',
        dueDate: null,
        depth: 0,
        containerId: 'day:today',
        subtreeIds: ['only'],
      },
    },
    disabled: false,
    key: 'only',
    node: { current: null },
  };

  const collisions = plannerCollisionDetection({
    active: {
      id: 'dragged',
      data: {
        current: {
          kind: 'task',
          taskId: 'dragged',
          parentTaskId: null,
          collectionId: 'c1',
          dueDate: null,
          depth: 0,
          // A different day - this is a foreign drop.
          containerId: 'day:2026-08-05',
          subtreeIds: ['dragged'],
        },
      },
      rect: { current: { initial: rect(0), translated: rect(pointerY) } },
    },
    collisionRect: rect(pointerY),
    droppableRects: new Map([
      ['only', rect(0)],
      ['day:today', targetDay.rect.current],
    ]),
    droppableContainers: [only, targetDay],
    pointerCoordinates: { x: 10, y: pointerY },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return collisions.map((c) => String(c.id));
}

describe('plannerCollisionDetection: foreign drop below the only row in a day', () => {
  // The row spans y 0-24. With the trailing slot reserved, the container spans
  // y 0-48: the row plus the 24px seam below it.
  const WITH_SLOT = 48;
  const WITHOUT_SLOT = 24;

  it('appends when the pointer is on the row', () => {
    // A foreign drag reads anywhere on the last row as "add at the end", so it
    // resolves to the day container rather than inserting before the row.
    expect(singleRowDayCandidates(10, WITH_SLOT)).toContain('day:today');
  });

  it('appends when the pointer is in the seam below the row', () => {
    // y=36 is past the row entirely, inside the reserved slot. This is the
    // position the user aims at to drop "after" the only task.
    expect(singleRowDayCandidates(36, WITH_SLOT)).toContain('day:today');
  });

  it('does not resolve to inserting before the only row', () => {
    expect(singleRowDayCandidates(36, WITH_SLOT)[0]).toBe('day:today');
  });

  /**
   * The regression itself, stated as a contrast.
   *
   * With the container measured *without* the trailing slot, the pointer at
   * y=36 is outside every droppable, so the drop falls back to nearest-row
   * matching and lands on 'only' - "insert before the last row", which is
   * precisely the reported bug. Pinning it here says why the padding has to be
   * in the measured rect rather than merely in the stylesheet.
   */
  it('falls back to the row when the slot is missing from the measured rect', () => {
    expect(singleRowDayCandidates(36, WITHOUT_SLOT)).toEqual(['only']);
  });
});
