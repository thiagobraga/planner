import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ApiHabit, ApiHabitGroup } from '../../api/client';
import { buildHabitSections } from '../habitTree';
import {
  flattenHabitRows,
  getHabitBlock,
  removeHabitBlock,
  canBecomeSubHabit,
  projectHabitMove,
  applyHabitProjection,
  containerForGroup,
  UNGROUPED_CONTAINER,
  HABIT_INDENT_WIDTH,
  type HabitRow,
} from '../habitProjection';

function habit(overrides: Partial<ApiHabit> & { id: string }): ApiHabit {
  return {
    name: overrides.id,
    parentId: null,
    groupId: null,
    orderValue: 0,
    completions: [],
    ...overrides,
  };
}

function group(id: string, orderValue = 0): ApiHabitGroup {
  return { id, name: id.toUpperCase(), orderValue };
}

function rowsOf(habits: ApiHabit[], groups: ApiHabitGroup[] = []): HabitRow[] {
  return flattenHabitRows(buildHabitSections(habits, groups));
}

/** One indent step right; the projection quantises by HABIT_INDENT_WIDTH. */
const INDENT = HABIT_INDENT_WIDTH;
const OUTDENT = -HABIT_INDENT_WIDTH;

describe('flattenHabitRows', () => {
  it('lists ungrouped roots first, then each group in order', () => {
    const rows = rowsOf(
      [
        habit({ id: 'loose', orderValue: 0 }),
        habit({ id: 'morning-a', groupId: 'g1', orderValue: 0 }),
        habit({ id: 'evening-a', groupId: 'g2', orderValue: 0 }),
      ],
      [group('g1', 0), group('g2', 1)],
    );

    expect(rows.map((r) => r.id)).toEqual(['loose', 'morning-a', 'evening-a']);
    expect(rows.map((r) => r.containerId)).toEqual([UNGROUPED_CONTAINER, 'g1', 'g2']);
  });

  it('places each sub-habit directly after its parent at depth 1', () => {
    const rows = rowsOf([
      habit({ id: 'parent', orderValue: 0 }),
      habit({ id: 'kid-b', parentId: 'parent', orderValue: 1 }),
      habit({ id: 'kid-a', parentId: 'parent', orderValue: 0 }),
      habit({ id: 'other', orderValue: 1 }),
    ]);

    expect(rows.map((r) => r.id)).toEqual(['parent', 'kid-a', 'kid-b', 'other']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0]);
    expect(rows[0]!.childIds).toEqual(['kid-a', 'kid-b']);
  });

  it('gives a sub-habit a null group and its parent container', () => {
    const rows = rowsOf(
      [habit({ id: 'root', groupId: 'g1' }), habit({ id: 'kid', parentId: 'root' })],
      [group('g1')],
    );

    const kid = rows.find((r) => r.id === 'kid')!;
    expect(kid.groupId).toBeNull();
    expect(kid.containerId).toBe('g1');
  });

  it('contributes no rows for an empty group', () => {
    const rows = rowsOf([habit({ id: 'loose' })], [group('empty')]);
    expect(rows.map((r) => r.id)).toEqual(['loose']);
  });
});

describe('getHabitBlock', () => {
  it('returns a root together with all of its children', () => {
    const rows = rowsOf([
      habit({ id: 'parent' }),
      habit({ id: 'kid-a', parentId: 'parent', orderValue: 0 }),
      habit({ id: 'kid-b', parentId: 'parent', orderValue: 1 }),
      habit({ id: 'next', orderValue: 1 }),
    ]);

    expect(getHabitBlock(rows, 'parent').map((r) => r.id)).toEqual(['parent', 'kid-a', 'kid-b']);
  });

  it('returns a lone block for a sub-habit', () => {
    const rows = rowsOf([habit({ id: 'parent' }), habit({ id: 'kid', parentId: 'parent' })]);
    expect(getHabitBlock(rows, 'kid').map((r) => r.id)).toEqual(['kid']);
  });

  it('returns nothing for an unknown id', () => {
    expect(getHabitBlock(rowsOf([habit({ id: 'a' })]), 'ghost')).toEqual([]);
  });
});

describe('removeHabitBlock', () => {
  it('lifts the whole block out and leaves the rest intact', () => {
    const rows = rowsOf([
      habit({ id: 'a', orderValue: 0 }),
      habit({ id: 'parent', orderValue: 1 }),
      habit({ id: 'kid', parentId: 'parent' }),
      habit({ id: 'z', orderValue: 2 }),
    ]);

    const { rest, block } = removeHabitBlock(rows, 'parent');
    expect(block.map((r) => r.id)).toEqual(['parent', 'kid']);
    expect(rest.map((r) => r.id)).toEqual(['a', 'z']);
  });
});

describe('canBecomeSubHabit', () => {
  it('permits a childless root', () => {
    expect(canBecomeSubHabit(rowsOf([habit({ id: 'leaf' })]), 'leaf')).toBe(true);
  });

  it('refuses a root that has children', () => {
    const rows = rowsOf([habit({ id: 'parent' }), habit({ id: 'kid', parentId: 'parent' })]);
    expect(canBecomeSubHabit(rows, 'parent')).toBe(false);
  });
});

describe('projectHabitMove - root reordering', () => {
  const rows = () =>
    rowsOf([
      habit({ id: 'a', orderValue: 0 }),
      habit({ id: 'b', orderValue: 1 }),
      habit({ id: 'c', orderValue: 2 }),
    ]);

  it('moves a root to the top of the list', () => {
    expect(projectHabitMove(rows(), 'c', 0, 0)).toEqual({
      parentId: null,
      groupId: null,
      depth: 0,
      position: 0,
    });
  });

  it('moves a root to the end of the list', () => {
    expect(projectHabitMove(rows(), 'a', 2, 0)).toEqual({
      parentId: null,
      groupId: null,
      depth: 0,
      position: 2,
    });
  });

  it('moves a root into the middle', () => {
    expect(projectHabitMove(rows(), 'a', 1, 0)?.position).toBe(1);
  });

  it('clamps an over-index past the end of the list', () => {
    expect(projectHabitMove(rows(), 'a', 99, 0)?.position).toBe(2);
  });
});

describe('projectHabitMove - group membership', () => {
  const habits = [
    habit({ id: 'loose', orderValue: 0 }),
    habit({ id: 'journaling', orderValue: 1 }),
    habit({ id: 'stretch', groupId: 'morning', orderValue: 0 }),
    habit({ id: 'water', groupId: 'morning', orderValue: 1 }),
  ];
  const groups = [group('morning', 0)];

  it('moves an ungrouped root into a group by dropping onto a member', () => {
    const rows = rowsOf(habits, groups);
    // rows: loose, journaling, stretch, water. Dragging journaling down onto
    // stretch lands it after stretch, as a sortable list does.
    const projection = projectHabitMove(rows, 'journaling', 2, 0);
    expect(projection).toEqual({ parentId: null, groupId: 'morning', depth: 0, position: 1 });
  });

  it('lands at the head of a group when dragged up onto its first member', () => {
    const rows = rowsOf(habits, groups);
    const projection = projectHabitMove(rows, 'water', 2, 0);
    expect(projection).toEqual({ parentId: null, groupId: 'morning', depth: 0, position: 0 });
  });

  it('appends to a group when dropping past its last member', () => {
    const rows = rowsOf(habits, groups);
    const projection = projectHabitMove(rows, 'journaling', 4, 0);
    expect(projection).toEqual({ parentId: null, groupId: 'morning', depth: 0, position: 2 });
  });

  it('moves a grouped root back out to the ungrouped list', () => {
    const rows = rowsOf(habits, groups);
    const projection = projectHabitMove(rows, 'stretch', 0, 0);
    expect(projection).toEqual({ parentId: null, groupId: null, depth: 0, position: 0 });
  });

  it('counts position only among siblings of the target group', () => {
    const rows = rowsOf(habits, groups);
    // 'loose' crosses two ungrouped rows to reach the group, but its position is
    // counted only among morning's own roots - one of them precedes it.
    expect(projectHabitMove(rows, 'loose', 2, 0)?.position).toBe(1);
  });
});

describe('projectHabitMove - hierarchy', () => {
  it('nests a leaf under the root above when dragged right', () => {
    const rows = rowsOf([habit({ id: 'a', orderValue: 0 }), habit({ id: 'b', orderValue: 1 })]);
    expect(projectHabitMove(rows, 'b', 1, INDENT)).toEqual({
      parentId: 'a',
      groupId: null,
      depth: 1,
      position: 0,
    });
  });

  it('promotes a sub-habit to a root when dragged left', () => {
    const rows = rowsOf([habit({ id: 'parent' }), habit({ id: 'kid', parentId: 'parent' })]);
    expect(projectHabitMove(rows, 'kid', 1, OUTDENT)).toEqual({
      parentId: null,
      groupId: null,
      depth: 0,
      position: 1,
    });
  });

  it('promotes a sub-habit into the group of its landing spot', () => {
    const rows = rowsOf(
      [
        habit({ id: 'parent', orderValue: 0 }),
        habit({ id: 'kid', parentId: 'parent' }),
        habit({ id: 'stretch', groupId: 'morning', orderValue: 0 }),
      ],
      [group('morning')],
    );
    // rest after lifting 'kid': parent, stretch. Landing on 'stretch'.
    expect(projectHabitMove(rows, 'kid', 1, OUTDENT)).toEqual({
      parentId: null,
      groupId: 'morning',
      depth: 0,
      position: 0,
    });
  });

  it('reorders sub-habits under the same parent', () => {
    const rows = rowsOf([
      habit({ id: 'parent' }),
      habit({ id: 'kid-a', parentId: 'parent', orderValue: 0 }),
      habit({ id: 'kid-b', parentId: 'parent', orderValue: 1 }),
    ]);
    // Lift kid-b, drop it at index 1 (right after parent): first child.
    expect(projectHabitMove(rows, 'kid-b', 1, 0)).toEqual({
      parentId: 'parent',
      groupId: null,
      depth: 1,
      position: 0,
    });
  });

  it('keeps a sub-habit under its parent when dropped between siblings', () => {
    const rows = rowsOf([
      habit({ id: 'parent' }),
      habit({ id: 'kid-a', parentId: 'parent', orderValue: 0 }),
      habit({ id: 'kid-b', parentId: 'parent', orderValue: 1 }),
      habit({ id: 'kid-c', parentId: 'parent', orderValue: 2 }),
    ]);
    expect(projectHabitMove(rows, 'kid-a', 2, 0)?.position).toBe(1);
  });

  it('never nests at the very first position, having nothing to attach to', () => {
    const rows = rowsOf([habit({ id: 'a', orderValue: 0 }), habit({ id: 'b', orderValue: 1 })]);
    expect(projectHabitMove(rows, 'b', 0, INDENT * 3)?.depth).toBe(0);
  });

  it('clamps an exaggerated horizontal drag to a single level', () => {
    const rows = rowsOf([habit({ id: 'a', orderValue: 0 }), habit({ id: 'b', orderValue: 1 })]);
    expect(projectHabitMove(rows, 'b', 1, INDENT * 5)?.depth).toBe(1);
  });
});

describe('projectHabitMove - a parent with children stays a root', () => {
  const rows = () =>
    rowsOf([
      habit({ id: 'target', orderValue: 0 }),
      habit({ id: 'parent', orderValue: 1 }),
      habit({ id: 'kid', parentId: 'parent' }),
    ]);

  it('refuses to nest a habit that has sub-habits', () => {
    const projection = projectHabitMove(rows(), 'parent', 1, INDENT * 3);
    expect(projection).toEqual({ parentId: null, groupId: null, depth: 0, position: 1 });
  });

  it('lands after another parent’s children rather than splitting them', () => {
    const source = rowsOf([
      habit({ id: 'host', orderValue: 0 }),
      habit({ id: 'host-kid', parentId: 'host' }),
      habit({ id: 'mover', orderValue: 1 }),
      habit({ id: 'mover-kid', parentId: 'mover' }),
    ]);
    // Aim between host and host-kid; the block must skip past the child run.
    const projection = projectHabitMove(source, 'mover', 1, 0);
    expect(projection?.depth).toBe(0);
    expect(projection?.position).toBe(1);
  });

  it('returns null for a habit that is not in the list', () => {
    expect(projectHabitMove(rows(), 'ghost', 0, 0)).toBeNull();
  });
});

describe('applyHabitProjection', () => {
  it('carries a parent’s children along with it', () => {
    const rows = rowsOf([
      habit({ id: 'a', orderValue: 0 }),
      habit({ id: 'parent', orderValue: 1 }),
      habit({ id: 'kid', parentId: 'parent' }),
    ]);
    const projection = projectHabitMove(rows, 'parent', 0, 0)!;
    const next = applyHabitProjection(rows, 'parent', projection, 0);

    expect(next.map((r) => r.id)).toEqual(['parent', 'kid', 'a']);
  });

  it('rewrites the container when a root changes group', () => {
    const rows = rowsOf(
      [habit({ id: 'loose', orderValue: 0 }), habit({ id: 'stretch', groupId: 'morning' })],
      [group('morning')],
    );
    const projection = projectHabitMove(rows, 'loose', 1, 0)!;
    const next = applyHabitProjection(rows, 'loose', projection, 1);

    const moved = next.find((r) => r.id === 'loose')!;
    expect(moved.groupId).toBe('morning');
    expect(moved.containerId).toBe('morning');
  });

  it('adopts the parent’s container when a leaf becomes a sub-habit', () => {
    const rows = rowsOf(
      [habit({ id: 'stretch', groupId: 'morning', orderValue: 0 }), habit({ id: 'loose', orderValue: 0 })],
      [group('morning')],
    );
    // rows: loose (ungrouped) then stretch (morning). Nest stretch under loose.
    const projection = projectHabitMove(rows, 'stretch', 1, INDENT)!;
    const next = applyHabitProjection(rows, 'stretch', projection, 1);

    const moved = next.find((r) => r.id === 'stretch')!;
    expect(moved.parentId).toBe('loose');
    expect(moved.groupId).toBeNull();
    expect(moved.containerId).toBe(UNGROUPED_CONTAINER);
  });
});

describe('containerForGroup', () => {
  it('maps a null group to the ungrouped container', () => {
    expect(containerForGroup(null)).toBe(UNGROUPED_CONTAINER);
    expect(containerForGroup('g1')).toBe('g1');
  });
});

describe('projection invariants', () => {
  const arbHabits = fc
    .array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 4 }),
        grouped: fc.boolean(),
        child: fc.boolean(),
      }),
      { minLength: 1, maxLength: 12 },
    )
    .map((specs) => {
      const seen = new Set<string>();
      const habits: ApiHabit[] = [];
      let lastRoot: string | null = null;
      for (const spec of specs) {
        if (seen.has(spec.id)) continue;
        seen.add(spec.id);
        if (spec.child && lastRoot) {
          habits.push(habit({ id: spec.id, parentId: lastRoot }));
        } else {
          habits.push(habit({ id: spec.id, groupId: spec.grouped ? 'morning' : null }));
          lastRoot = spec.id;
        }
      }
      return habits;
    })
    .filter((habits) => habits.length > 0);

  it('never loses, duplicates or splits a habit, whatever the drop', () => {
    fc.assert(
      fc.property(
        arbHabits,
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: -3, max: 3 }),
        fc.nat(),
        (habits, overIndex, steps, pick) => {
          const rows = rowsOf(habits, [group('morning')]);
          const active = rows[pick % rows.length]!;

          const projection = projectHabitMove(rows, active.id, overIndex, steps * INDENT);
          if (!projection) return;

          const next = applyHabitProjection(rows, active.id, projection, overIndex);

          // Every habit survives exactly once.
          expect(next.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());

          // The hierarchy stays one level deep.
          for (const row of next) expect(row.depth === 0 || row.depth === 1).toBe(true);

          // Every child still sits immediately under a root.
          next.forEach((row, i) => {
            if (row.depth !== 1) return;
            const above = next[i - 1];
            expect(above).toBeDefined();
            expect(above!.depth === 0 || above!.depth === 1).toBe(true);
          });

          // A parent never becomes a sub-habit.
          if (active.childIds.length > 0) expect(projection.depth).toBe(0);

          // A sub-habit never holds a group of its own.
          if (projection.depth === 1) expect(projection.groupId).toBeNull();

          // Position is a real sibling index.
          expect(projection.position).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
