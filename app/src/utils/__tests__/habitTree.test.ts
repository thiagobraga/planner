import { describe, it, expect } from 'vitest';
import type { ApiHabit, ApiHabitGroup } from '../../api/client';
import {
  buildHabitTree,
  buildHabitSections,
  dayState,
  parentToggleTarget,
  habitsToToggle,
  flattenHabits,
} from '../habitTree';

const DAY = '2026-07-18';

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

describe('buildHabitTree', () => {
  it('nests sub-habits under their parent', () => {
    const roots = buildHabitTree([
      habit({ id: 'water' }),
      habit({ id: '1L', parentId: 'water', orderValue: 0 }),
      habit({ id: '2L', parentId: 'water', orderValue: 1 }),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0].children.map((c) => c.id)).toEqual(['1L', '2L']);
  });

  it('sorts roots and children by orderValue', () => {
    const roots = buildHabitTree([
      habit({ id: 'b', orderValue: 1 }),
      habit({ id: 'a', orderValue: 0 }),
      habit({ id: 'a2', parentId: 'a', orderValue: 1 }),
      habit({ id: 'a1', parentId: 'a', orderValue: 0 }),
    ]);

    expect(roots.map((r) => r.id)).toEqual(['a', 'b']);
    expect(roots[0].children.map((c) => c.id)).toEqual(['a1', 'a2']);
  });

  it('promotes an orphan to a root instead of dropping it', () => {
    const roots = buildHabitTree([habit({ id: 'lost', parentId: 'deleted-parent' })]);

    expect(roots.map((r) => r.id)).toEqual(['lost']);
  });

  it('does not let a habit parent itself into an empty result', () => {
    const roots = buildHabitTree([habit({ id: 'self', parentId: 'self' })]);

    expect(roots.map((r) => r.id)).toEqual(['self']);
  });
});

describe('dayState', () => {
  it('reports a leaf as full or empty', () => {
    const [done] = buildHabitTree([habit({ id: 'x', completions: [DAY] })]);
    const [notDone] = buildHabitTree([habit({ id: 'y' })]);

    expect(dayState(done, DAY)).toBe('full');
    expect(dayState(notDone, DAY)).toBe('empty');
  });

  it('reports half when only some sub-habits are done', () => {
    const [water] = buildHabitTree([
      habit({ id: 'water' }),
      habit({ id: '1L', parentId: 'water', completions: [DAY] }),
      habit({ id: '2L', parentId: 'water', completions: [DAY] }),
      habit({ id: '3L', parentId: 'water' }),
      habit({ id: '4L', parentId: 'water' }),
    ]);

    expect(dayState(water, DAY)).toBe('half');
  });

  it('reports full only when every sub-habit is done', () => {
    const build = (doneCount: number) =>
      buildHabitTree([
        habit({ id: 'dogs' }),
        ...['meg', 'snoopy', 'lucy'].map((id, i) =>
          habit({ id, parentId: 'dogs', completions: i < doneCount ? [DAY] : [] }),
        ),
      ])[0];

    expect(dayState(build(0), DAY)).toBe('empty');
    expect(dayState(build(2), DAY)).toBe('half');
    expect(dayState(build(3), DAY)).toBe('full');
  });

  it('ignores a parent’s own stored completions once it has children', () => {
    // The API refuses to write these, but a stale cache could still carry them.
    const [parent] = buildHabitTree([
      habit({ id: 'p', completions: [DAY] }),
      habit({ id: 'c', parentId: 'p' }),
    ]);

    expect(dayState(parent, DAY)).toBe('empty');
  });
});

describe('parentToggleTarget', () => {
  it('completes the remaining sub-habits when partially done', () => {
    const [water] = buildHabitTree([
      habit({ id: 'water' }),
      habit({ id: '1L', parentId: 'water', completions: [DAY] }),
      habit({ id: '2L', parentId: 'water' }),
    ]);

    expect(parentToggleTarget(water, DAY)).toBe(true);
  });

  it('clears everything when already fully done', () => {
    const [water] = buildHabitTree([
      habit({ id: 'water' }),
      habit({ id: '1L', parentId: 'water', completions: [DAY] }),
    ]);

    expect(parentToggleTarget(water, DAY)).toBe(false);
  });
});

describe('habitsToToggle', () => {
  it('returns only the sub-habits that actually change', () => {
    const [water] = buildHabitTree([
      habit({ id: 'water' }),
      habit({ id: '1L', parentId: 'water', completions: [DAY] }),
      habit({ id: '2L', parentId: 'water' }),
      habit({ id: '3L', parentId: 'water' }),
    ]);

    const toToggle = habitsToToggle(water, DAY, true);

    expect(toToggle.map((h) => h.id)).toEqual(['2L', '3L']);
  });

  it('returns the leaf itself for a childless habit', () => {
    const [solo] = buildHabitTree([habit({ id: 'journal' })]);

    expect(habitsToToggle(solo, DAY, true).map((h) => h.id)).toEqual(['journal']);
    expect(habitsToToggle(solo, DAY, false)).toEqual([]);
  });
});

describe('buildHabitSections', () => {
  it('separates ungrouped habits from grouped ones, in group order', () => {
    const sections = buildHabitSections(
      [
        habit({ id: 'water' }),
        habit({ id: 'meds', groupId: 'morning' }),
        habit({ id: 'plants', groupId: 'morning' }),
      ],
      [group('morning', 0), group('evening', 1)],
    );

    expect(sections.ungrouped.map((h) => h.id)).toEqual(['water']);
    expect(sections.groups.map((s) => s.group.id)).toEqual(['morning', 'evening']);
    expect(sections.groups[0].habits.map((h) => h.id)).toEqual(['meds', 'plants']);
    expect(sections.groups[1].habits).toEqual([]);
  });

  it('falls back to ungrouped when the group is unknown', () => {
    const sections = buildHabitSections([habit({ id: 'orphan', groupId: 'gone' })], []);

    expect(sections.ungrouped.map((h) => h.id)).toEqual(['orphan']);
  });

  it('keeps sub-habits with their parent rather than in the group list', () => {
    const sections = buildHabitSections(
      [
        habit({ id: 'meds', groupId: 'morning' }),
        habit({ id: 'bupropiona', parentId: 'meds' }),
      ],
      [group('morning')],
    );

    expect(sections.groups[0].habits.map((h) => h.id)).toEqual(['meds']);
    expect(sections.groups[0].habits[0].children.map((c) => c.id)).toEqual(['bupropiona']);
  });
});

describe('flattenHabits', () => {
  it('emits parents at depth 0 and children at depth 1, in order', () => {
    const roots = buildHabitTree([
      habit({ id: 'water', orderValue: 0 }),
      habit({ id: '1L', parentId: 'water' }),
      habit({ id: 'journal', orderValue: 1 }),
    ]);

    expect(flattenHabits(roots)).toEqual([
      { node: expect.objectContaining({ id: 'water' }), depth: 0 },
      { node: expect.objectContaining({ id: '1L' }), depth: 1 },
      { node: expect.objectContaining({ id: 'journal' }), depth: 0 },
    ]);
  });
});
