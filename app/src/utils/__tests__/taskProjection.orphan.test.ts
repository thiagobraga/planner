import { describe, it, expect } from 'vitest';
import { flattenTasks } from '../taskProjection';

/**
 * Daily renders one date at a time while `depth` describes the whole task tree,
 * so a task parented to a task on another date has an ancestor that is nowhere
 * in the list. Rendering it at its stored depth drew an indent level with
 * nothing above it to belong to - a subtree at level 2 under a level 1 row with
 * no level 0 anchor in the section at all.
 *
 * flattenTasks already promotes such a row to a root; these pin the depths it
 * hands back, because that is what the rows are now indented by.
 */

interface Row {
  id: string;
  parentTaskId?: string;
  orderValue: number;
  createdAt?: string;
}

const row = (id: string, orderValue: number, parentTaskId?: string): Row => ({
  id,
  orderValue,
  parentTaskId,
});

describe('flattenTasks: depth is relative to the rendered list', () => {
  it('promotes a row whose parent is absent, and lifts its children with it', () => {
    // The shape of the reported bug: "Faxina" is parented to a task two months
    // back, so only it and its two children are in this date's list.
    const flat = flattenTasks([
      row('faxina', 1000, 'a-task-on-another-date'),
      row('talheres', 0, 'faxina'),
      row('copos', 100, 'faxina'),
    ]);

    expect(flat.map((r) => [r.id, r.depth])).toEqual([
      ['faxina', 0],
      ['talheres', 1],
      ['copos', 1],
    ]);
  });

  it('never emits a depth without the depth above it already present', () => {
    const flat = flattenTasks([
      row('orphan', 0, 'missing'),
      row('child', 100, 'orphan'),
      row('grandchild', 200, 'child'),
    ]);

    const seen = new Set<number>([-1]);
    for (const { depth } of flat) {
      expect(seen.has(depth - 1)).toBe(true);
      seen.add(depth);
    }
  });

  it('keeps siblings level rather than letting the second one drift deeper', () => {
    const flat = flattenTasks([
      row('orphan', 0, 'missing'),
      row('first', 100, 'orphan'),
      row('second', 200, 'orphan'),
    ]);

    expect(flat.find((r) => r.id === 'first')!.depth).toBe(
      flat.find((r) => r.id === 'second')!.depth,
    );
  });

  it('leaves a fully present subtree at its natural depths', () => {
    const flat = flattenTasks([
      row('parent', 0),
      row('child', 100, 'parent'),
      row('grandchild', 200, 'child'),
      row('sibling', 300),
    ]);

    expect(flat.map((r) => [r.id, r.depth])).toEqual([
      ['parent', 0],
      ['child', 1],
      ['grandchild', 2],
      ['sibling', 0],
    ]);
  });
});
