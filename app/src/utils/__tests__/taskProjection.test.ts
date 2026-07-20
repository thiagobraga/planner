import { describe, it, expect } from 'vitest';
import {
  buildSubtreeIndex,
  flattenTasks,
  getSubtreeBlock,
  removeBlock,
  insertBlock,
  projectMove,
  applyProjection,
  MAX_DEPTH,
  INDENT_WIDTH,
  type TaskLike,
} from '../taskProjection';

function t(id: string, parentTaskId: string | null = null, orderValue = 0, createdAt = '2026-01-01'): TaskLike {
  return { id, parentTaskId, orderValue, createdAt };
}

/** `a > b > c` reads as "b is a child of a, c is a child of b". */
const sample = [
  t('a', null, 0),
  t('a1', 'a', 0),
  t('a2', 'a', 1000),
  t('b', null, 1000),
  t('b1', 'b', 0),
  t('b1x', 'b1', 0),
  t('c', null, 2000),
];

const shape = (rows: ReturnType<typeof flattenTasks>) =>
  rows.map((r) => `${'  '.repeat(r.depth)}${r.id}`);

describe('flattenTasks', () => {
  it('renders parents before their children, siblings in order value order', () => {
    expect(shape(flattenTasks(sample))).toEqual([
      'a',
      '  a1',
      '  a2',
      'b',
      '  b1',
      '    b1x',
      'c',
    ]);
  });

  it('is insensitive to input order', () => {
    const shuffled = [...sample].reverse();
    expect(shape(flattenTasks(shuffled))).toEqual(shape(flattenTasks(sample)));
  });

  it('breaks ties on createdAt when order values are equal', () => {
    const tied = [
      t('x', null, 500, '2026-03-01'),
      t('y', null, 500, '2026-01-01'),
      t('z', null, 500, '2026-02-01'),
    ];
    expect(flattenTasks(tied).map((r) => r.id)).toEqual(['y', 'z', 'x']);
  });

  it('promotes a task whose parent is missing rather than hiding it', () => {
    const orphaned = [t('a', null, 0), t('lost', 'not-here', 1000)];
    const rows = flattenTasks(orphaned);
    expect(rows.map((r) => r.id)).toContain('lost');
    expect(rows.find((r) => r.id === 'lost')).toMatchObject({ depth: 0, parentId: null });
  });

  it('does not spin on a legacy parent cycle, and keeps every task', () => {
    const cyclic = [t('p', 'q'), t('q', 'p'), t('r', null)];
    const rows = flattenTasks(cyclic);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(['p', 'q', 'r']));
  });

  it('returns each task exactly once', () => {
    const ids = flattenTasks(sample).map((r) => r.id);
    expect(ids).toHaveLength(sample.length);
    expect(new Set(ids).size).toBe(sample.length);
  });
});

describe('getSubtreeBlock', () => {
  it('returns the root plus every descendant, contiguously', () => {
    const rows = flattenTasks(sample);
    expect(getSubtreeBlock(rows, 'b').map((r) => r.id)).toEqual(['b', 'b1', 'b1x']);
  });

  it('returns just the task for a leaf', () => {
    const rows = flattenTasks(sample);
    expect(getSubtreeBlock(rows, 'a1').map((r) => r.id)).toEqual(['a1']);
  });

  it('returns nothing for an unknown id', () => {
    expect(getSubtreeBlock(flattenTasks(sample), 'nope')).toEqual([]);
  });
});

describe('buildSubtreeIndex', () => {
  it('agrees with getSubtreeBlock for every row', () => {
    const rows = flattenTasks(sample);
    const index = buildSubtreeIndex(rows);

    for (const row of rows) {
      expect(index.get(row.id)).toEqual(getSubtreeBlock(rows, row.id).map((r) => r.id));
    }
  });

  it('leads with the row itself and covers every row exactly once at the root', () => {
    const rows = flattenTasks(sample);
    const index = buildSubtreeIndex(rows);

    for (const row of rows) expect(index.get(row.id)![0]).toBe(row.id);
    expect(index.size).toBe(rows.length);
  });

  it('returns an empty index for no rows', () => {
    expect(buildSubtreeIndex([]).size).toBe(0);
  });
});

describe('removeBlock / insertBlock', () => {
  it('lifts a subtree out without splitting it', () => {
    const { rest, block } = removeBlock(flattenTasks(sample), 'b');
    expect(block.map((r) => r.id)).toEqual(['b', 'b1', 'b1x']);
    expect(rest.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'c']);
  });

  it('preserves descendant depth relative to the root when re-rooting deeper', () => {
    const { rest, block } = removeBlock(flattenTasks(sample), 'b');
    const out = insertBlock(rest, block, 1, 'a', 1);
    expect(shape(out)).toEqual(['a', '  b', '    b1', '      b1x', '  a1', '  a2', 'c']);
  });

  it('round-trips when removed and put back where it was', () => {
    const rows = flattenTasks(sample);
    const { rest, block } = removeBlock(rows, 'b');
    const out = insertBlock(rest, block, 3, null, 0);
    expect(shape(out)).toEqual(shape(rows));
  });
});

describe('projectMove depth clamping', () => {
  const rows = flattenTasks(sample);

  it('nests under the row above when dragged one step right', () => {
    // Drop `c` (last) just after `a2`, pushed one indent right.
    expect(projectMove(rows, 'c', 3, INDENT_WIDTH)).toMatchObject({ parentId: 'a', depth: 1 });
  });

  it('cannot skip a level, however far right it is dragged', () => {
    const p = projectMove(rows, 'c', 3, INDENT_WIDTH * 10);
    // Row above is `a2` at depth 1, so the deepest legal landing is depth 2.
    expect(p.depth).toBe(2);
    expect(p.parentId).toBe('a2');
  });

  it('outdents to the root at the far left', () => {
    expect(projectMove(rows, 'a2', 2, -INDENT_WIDTH * 10)).toMatchObject({
      parentId: null,
      depth: 0,
    });
  });

  it('refuses to exceed the maximum depth', () => {
    // A chain already at the depth limit; anything below must clamp to it.
    const deep: TaskLike[] = [];
    for (let i = 0; i <= MAX_DEPTH; i++) {
      deep.push(t(`d${i}`, i === 0 ? null : `d${i - 1}`, 0));
    }
    deep.push(t('mover', null, 9000));
    const deepRows = flattenTasks(deep);
    const p = projectMove(deepRows, 'mover', deepRows.length - 1, INDENT_WIDTH * 20);
    expect(p.depth).toBeLessThanOrEqual(MAX_DEPTH);
  });

  it('stays at least as deep as the row below, so it cannot orphan it', () => {
    // Landing above `a1` (depth 1) at depth 0 would leave `a1` parentless.
    const p = projectMove(rows, 'c', 1, -INDENT_WIDTH * 5);
    expect(p.depth).toBeGreaterThanOrEqual(1);
  });

  it('never projects into the dragged task’s own subtree', () => {
    // Every landing index for a parent drag must resolve to a parent outside it.
    const block = new Set(getSubtreeBlock(rows, 'b').map((r) => r.id));
    for (let i = 0; i <= rows.length; i++) {
      for (const offset of [-INDENT_WIDTH * 3, 0, INDENT_WIDTH * 3]) {
        const p = projectMove(rows, 'b', i, offset);
        expect(p.parentId === null || !block.has(p.parentId)).toBe(true);
      }
    }
  });
});

describe('projectMove sibling position', () => {
  it('counts siblings, not flat rows', () => {
    const rows = flattenTasks(sample);
    // Dropping at the very end at root level: roots are a, b, c; b is being
    // dragged, so the remaining roots are a and c and the tail index is 2.
    const p = projectMove(rows, 'b', rows.length, 0);
    expect(p).toMatchObject({ parentId: null, depth: 0, position: 2 });
  });

  it('gives position 0 at the top of the list', () => {
    const rows = flattenTasks(sample);
    expect(projectMove(rows, 'c', 0, 0)).toMatchObject({ position: 0, parentId: null });
  });

  it('reorders a leaf at every boundary of its sibling list', () => {
    const flat = [t('x', null, 0), t('y', null, 1000), t('z', null, 2000)];
    const rows = flattenTasks(flat);
    expect(projectMove(rows, 'z', 0, 0).position).toBe(0); // to the front
    expect(projectMove(rows, 'z', 1, 0).position).toBe(1); // between x and y
    // Dragging x to the end: with x lifted out, [y, z] remain, so the tail is 2.
    expect(projectMove(rows, 'x', 2, 0).position).toBe(2);
  });
});

describe('applyProjection', () => {
  it('moves a parent block into another branch intact', () => {
    const rows = flattenTasks(sample);
    const { rows: out } = applyProjection(rows, 'b', 1, INDENT_WIDTH);
    expect(shape(out)).toEqual(['a', '  b', '    b1', '      b1x', '  a1', '  a2', 'c']);
  });

  it('keeps every id exactly once after a move', () => {
    const rows = flattenTasks(sample);
    const { rows: out } = applyProjection(rows, 'b', 6, 0);
    expect(out.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });
});

describe('cross-container root move', () => {
  // A Daily date section and a collection list are separate rendered containers,
  // but each is projected against its own row list. Moving a root out of one and
  // into another is therefore a projection against the *target* list, in which
  // the dragged block does not yet appear.
  const target = [t('x', null, 0), t('x1', 'x', 0), t('y', null, 1000)];

  it('lands a root at top level in a list it did not come from', () => {
    const incoming = [...target, t('moved', null, 2000)];
    const rows = flattenTasks(incoming);

    // Dropped onto 'y', with no horizontal offset: a sibling of the target roots.
    const projection = projectMove(rows, 'moved', 2, 0);

    expect(projection.parentId).toBeNull();
    expect(projection.depth).toBe(0);
    expect(projection.position).toBe(1);
  });

  it('carries its subtree into the target container at the projected depth', () => {
    const incoming = [...target, t('moved', null, 2000), t('moved1', 'moved', 0)];
    const rows = flattenTasks(incoming);

    // Nest the arriving root under 'x' by dragging one indent step right.
    const { rows: next, projection } = applyProjection(rows, 'moved', 2, INDENT_WIDTH);

    expect(projection.parentId).toBe('x');
    expect(projection.depth).toBe(1);
    // The child follows its parent and keeps its depth relative to it.
    expect(shape(next)).toEqual(['x', '  x1', '  moved', '    moved1', 'y']);
  });

  it('appends to an empty target container', () => {
    const rows = flattenTasks([t('moved', null, 0)]);
    const projection = projectMove(rows, 'moved', 0, 0);

    expect(projection).toEqual({ parentId: null, depth: 0, position: 0 });
  });
});

describe('property: structural invariants hold for every move', () => {
  const rows = flattenTasks(sample);
  const ids = rows.map((r) => r.id);
  const offsets = [-INDENT_WIDTH * 2, -INDENT_WIDTH, 0, INDENT_WIDTH, INDENT_WIDTH * 2];

  it('preserves every task, loses none and duplicates none, at every destination', () => {
    for (const id of ids) {
      for (let index = 0; index <= rows.length; index++) {
        for (const offset of offsets) {
          const { rows: out } = applyProjection(rows, id, index, offset);
          const outIds = out.map((r) => r.id);
          expect(new Set(outIds).size, `duplicate after moving ${id} to ${index}@${offset}`).toBe(
            outIds.length,
          );
          expect(outIds.slice().sort(), `lost a task moving ${id} to ${index}@${offset}`).toEqual(
            ids.slice().sort(),
          );
        }
      }
    }
  });

  it('always renders every descendant after its ancestor, at a legal depth', () => {
    for (const id of ids) {
      for (let index = 0; index <= rows.length; index++) {
        for (const offset of offsets) {
          const { rows: out } = applyProjection(rows, id, index, offset);
          const seen = new Set<string>();
          let prevDepth = -1;
          for (const row of out) {
            const where = `moving ${id} to ${index}@${offset}`;
            // Depth may only ever grow one step at a time going down the list.
            expect(row.depth, `depth jump ${where}`).toBeLessThanOrEqual(prevDepth + 1);
            expect(row.depth, `negative depth ${where}`).toBeGreaterThanOrEqual(0);
            expect(row.depth, `over max depth ${where}`).toBeLessThanOrEqual(MAX_DEPTH);
            if (row.parentId !== null && seen.size > 0) {
              // A parent, when present in this list, must already have rendered.
              const parentPresent = out.some((r) => r.id === row.parentId);
              if (parentPresent) {
                expect(seen.has(row.parentId), `descendant before ancestor ${where}`).toBe(true);
              }
            }
            seen.add(row.id);
            prevDepth = row.depth;
          }
        }
      }
    }
  });
});
