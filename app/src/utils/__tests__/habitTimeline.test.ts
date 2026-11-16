import { describe, expect, it } from 'vitest';
import type { HabitNode, HabitSections } from '../habitTree';
import {
  buildTimelineSections,
  dayLink,
  findNodeWithDepth,
  labelColumnWidth,
  timelineSortableIds,
} from '../habitTimeline';

function habit(id: string, completions: string[] = [], children: HabitNode[] = [], parentId: string | null = null): HabitNode {
  return { id, name: id, parentId, groupId: null, orderValue: 0, completions: new Set(completions), children };
}

const child = habit('child', [], [], 'parent');
const sections: HabitSections = {
  ungrouped: [habit('parent', [], [child])],
  groups: [{ group: { id: 'g1', name: 'Home', icon: null, orderValue: 0 }, habits: [habit('sweep')] }],
};

describe('labelColumnWidth', () => {
  it.each([
    [null, 264],
    [1000, 264],
    [366, 192],
    [354, 168],
    [100, 0],
  ])('fits the week next to the names at %s px', (width, expected) => {
    expect(labelColumnWidth(width)).toBe(expected);
  });
});

describe('buildTimelineSections', () => {
  it('lays out ungrouped habits, each group, then the add-group tail', () => {
    const rows = buildTimelineSections(sections, new Set(), null).map((s) => s.rows.map((r) => r.key));
    expect(rows).toEqual([
      ['habit-parent', 'habit-child', 'add-habit-root'],
      ['spacer-g1', 'group-g1', 'habit-sweep', 'add-habit-g1'],
      ['spacer-add-group', 'add-group'],
    ]);
  });

  it('hides sub-habits of a collapsed parent and of a parent in flight', () => {
    const keys = (collapsed: Set<string>, drag: string | null) =>
      buildTimelineSections(sections, collapsed, drag)[0]!.rows.map((r) => r.key);
    expect(keys(new Set(['parent']), null)).toEqual(['habit-parent', 'add-habit-root']);
    expect(keys(new Set(), 'parent')).toEqual(['habit-parent', 'add-habit-root']);
  });
});

describe('timelineSortableIds', () => {
  it('lists habit rows and group headers only', () => {
    const rows = buildTimelineSections(sections, new Set(), null).flatMap((s) => s.rows);
    expect(timelineSortableIds(rows)).toEqual(['parent', 'child', 'g1', 'sweep']);
  });
});

describe('findNodeWithDepth', () => {
  it('finds nested habits with their depth', () => {
    expect(findNodeWithDepth(sections.ungrouped, 'child')).toEqual({ node: child, depth: 1 });
    expect(findNodeWithDepth(sections.ungrouped, 'missing')).toBeNull();
  });
});

describe('dayLink', () => {
  const day = (iso: string, future = false) => ({ iso, letter: 'S', dayOfMonth: 1, future, isWeekend: false });
  const days = [day('2026-11-15'), day('2026-11-16'), day('2026-11-17', true)];

  it('links consecutive marked days but never into the future', () => {
    const node = habit('h', ['2026-11-15', '2026-11-16', '2026-11-17']);
    expect(dayLink(node, days, 0)).toMatchObject({ prevLinked: false, nextLinked: true });
    expect(dayLink(node, days, 1)).toMatchObject({ prevLinked: true, nextLinked: false });
  });
});
