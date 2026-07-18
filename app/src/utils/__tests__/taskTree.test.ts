import { describe, it, expect } from 'vitest';
import {
  computeIndent,
  getParentCandidate,
  getDescendants,
  applyIndent,
  MAX_INDENT,
  type TreeNode,
} from '../taskTree';

// Build a flat list from [id, indent] pairs.
function list(...rows: Array<[string, number]>): TreeNode[] {
  return rows.map(([id, indent]) => ({ id, indent }));
}

// Like `list` but with a collection id per row: [id, indent, collectionId].
function plist(...rows: Array<[string, number, string]>): TreeNode[] {
  return rows.map(([id, indent, collectionId]) => ({ id, indent, collectionId }));
}

describe('computeIndent', () => {
  it('Tab on a solo task is a no-op', () => {
    expect(computeIndent(list(['a', 0]), 0, 1)).toBeNull();
  });

  it('Tab on the first task in a non-empty list is a no-op', () => {
    expect(computeIndent(list(['a', 0], ['b', 0]), 0, 1)).toBeNull();
  });

  it('Tab nests a task under the preceding sibling', () => {
    expect(computeIndent(list(['a', 0], ['b', 0]), 1, 1)).toBe(1);
  });

  it('Tab on the first child is a no-op (already deepest allowed)', () => {
    // a(0) / b(1) - b cannot indent further under a
    expect(computeIndent(list(['a', 0], ['b', 1]), 1, 1)).toBeNull();
  });

  it('Tab cannot skip levels: max is prev.indent + 1', () => {
    // a(0) / b(1) / c(0) - c indents to 1, not 2
    expect(computeIndent(list(['a', 0], ['b', 1], ['c', 0]), 2, 1)).toBe(1);
  });

  it('Tab is capped at MAX_INDENT', () => {
    const deep = list(['a', MAX_INDENT], ['b', MAX_INDENT]);
    expect(computeIndent(deep, 1, 1)).toBeNull();
  });

  it('Shift+Tab promotes one level', () => {
    expect(computeIndent(list(['a', 0], ['b', 1]), 1, -1)).toBe(0);
  });

  it('Shift+Tab at top level is a no-op', () => {
    expect(computeIndent(list(['a', 0]), 0, -1)).toBeNull();
  });
});

describe('getParentCandidate', () => {
  it('returns null at the top level', () => {
    expect(getParentCandidate(list(['a', 0], ['b', 0]), 1, 0)).toBeNull();
  });

  it('finds the nearest preceding task one level shallower', () => {
    // a(0) / b(1) / c(0) - c indented to 1 → parent is a
    expect(getParentCandidate(list(['a', 0], ['b', 1], ['c', 0]), 2, 1)).toBe('a');
  });

  it('picks the immediate preceding sibling as parent', () => {
    expect(getParentCandidate(list(['a', 0], ['b', 0]), 1, 1)).toBe('a');
  });

  it('finds a grandparent for Shift+Tab promotion', () => {
    // a(0) / b(1) / c(2) - c promoted to 1 → parent is a (indent 0)
    expect(getParentCandidate(list(['a', 0], ['b', 1], ['c', 2]), 2, 1)).toBe('a');
  });
});

describe('getDescendants', () => {
  it('returns the contiguous deeper run', () => {
    const l = list(['a', 0], ['b', 1], ['c', 2], ['d', 0]);
    expect(getDescendants(l, 0).map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('stops at a task at the same level', () => {
    const l = list(['a', 1], ['b', 2], ['c', 1]);
    expect(getDescendants(l, 0).map((t) => t.id)).toEqual(['b']);
  });

  it('returns empty when the task has no children', () => {
    const l = list(['a', 0], ['b', 0]);
    expect(getDescendants(l, 0)).toEqual([]);
  });
});

describe('applyIndent', () => {
  it('reports no change and leaves the list intact on a no-op', () => {
    const l = list(['a', 0], ['b', 0]);
    const r = applyIndent(l, 'a', 1); // first task Tab
    expect(r.changed).toBe(false);
    expect(r.tasks).toBe(l);
  });

  it('reparents on Tab and returns the parent id', () => {
    const r = applyIndent(list(['a', 0], ['b', 0]), 'b', 1);
    expect(r.changed).toBe(true);
    expect(r.parentTaskId).toBe('a');
    expect(r.tasks.map((t) => t.indent)).toEqual([0, 1]);
  });

  it('shifts the descendant subtree by the same delta', () => {
    // a(0) / b(0) / c(1) / d(2) - Tab on b nests it under a; c,d follow
    const r = applyIndent(list(['a', 0], ['b', 0], ['c', 1], ['d', 2]), 'b', 1);
    expect(r.tasks.map((t) => t.indent)).toEqual([0, 1, 2, 3]);
  });

  it('unparents to top level on Shift+Tab, parentTaskId null', () => {
    const r = applyIndent(list(['a', 0], ['b', 1]), 'b', -1);
    expect(r.changed).toBe(true);
    expect(r.parentTaskId).toBeNull();
    expect(r.tasks.map((t) => t.indent)).toEqual([0, 0]);
  });

  it('sameCollectionOnly: no-op when the structural parent is a different collection', () => {
    const l = plist(['a', 0, 'p1'], ['b', 0, 'p2']);
    const r = applyIndent(l, 'b', 1, { sameCollectionOnly: true });
    expect(r.changed).toBe(false);
    expect(r.tasks).toBe(l);
  });

  it('sameCollectionOnly: allows nesting under a same-collection parent', () => {
    const l = plist(['a', 0, 'p1'], ['b', 0, 'p1']);
    const r = applyIndent(l, 'b', 1, { sameCollectionOnly: true });
    expect(r.changed).toBe(true);
    expect(r.parentTaskId).toBe('a');
  });
});
