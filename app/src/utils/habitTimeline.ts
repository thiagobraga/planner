import type { TimelineDayCell, TimelineNodeAtDepth, TimelineRow, TimelineSection } from '../types/habitTimeline';
import { dayState, flattenHabits } from './habitTree';
import type { HabitNode, HabitSections } from '../types/habits';
import { UNGROUPED_CONTAINER } from './habitProjection';

export const CELL_W = 24;
export const WEEK_W = CELL_W * 7;
// The label column stays on a 24px multiple so the day grid lands on the
// dotted paper background. It shrinks on narrow screens so the whole week fits.
export const LABEL_COL_W = 264;
export const INDENT = 24;

/** The widest label column, on the 24px grid, that still leaves room for the whole week. */
export function labelColumnWidth(timelineWidth: number | null): number {
  if (timelineWidth == null) return LABEL_COL_W;
  const fitted = Math.floor((timelineWidth - WEEK_W) / CELL_W) * CELL_W;
  return Math.max(0, Math.min(LABEL_COL_W, fitted));
}

/**
 * A day's mark and whether it joins the run either side of it.
 *
 * Any day with progress is part of the chain, so a partly-done parent day links
 * rather than breaking the run. Shared by the live row and the drag preview so
 * a habit lifted off the list draws the same chain it drew in place.
 */
export function dayLink(node: HabitNode, days: TimelineDayCell[], i: number) {
  const state = dayState(node, days[i]!.iso);
  const linked = state !== 'empty';
  return {
    state,
    prevLinked: i > 0 && linked && dayState(node, days[i - 1]!.iso) !== 'empty',
    nextLinked:
      i < days.length - 1 &&
      linked &&
      !days[i + 1]!.future &&
      dayState(node, days[i + 1]!.iso) !== 'empty',
  };
}

/** Locate a habit anywhere in the tree, keeping the depth it renders at. */
export function findNodeWithDepth(nodes: HabitNode[], id: string, depth = 0): TimelineNodeAtDepth | null {
  for (const node of nodes) {
    if (node.id === id) return { node, depth };
    const found = findNodeWithDepth(node.children, id, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The ungrouped list, one section per group, then the trailing add-group area. */
export function buildTimelineSections(
  sections: HabitSections,
  collapsed: ReadonlySet<string>,
  activeDragId: string | null | undefined,
): TimelineSection[] {
  // A dragged parent's sub-habits are pulled out of the list for the duration
  // of the drag, exactly as the task list does: dnd-kit sorts each row on its
  // own, so leaving them behind would strand them under the wrong parent while
  // the block is in flight. The overlay's "+N" stands in for them.
  const carried = new Set<string>();
  if (activeDragId) {
    const dragged = [...sections.ungrouped, ...sections.groups.flatMap((s) => s.habits)].find(
      (node) => node.id === activeDragId,
    );
    for (const child of dragged?.children ?? []) carried.add(child.id);
  }

  const habitRows = (nodes: HabitNode[], groupId: string | null): TimelineRow[] => {
    const out: TimelineRow[] = [];
    for (const { node, depth } of flattenHabits(nodes)) {
      // A collapsed parent hides its sub-habits but keeps its own row.
      if (depth > 0 && node.parentId && collapsed.has(node.parentId)) continue;
      if (carried.has(node.id)) continue;
      out.push({ key: `habit-${node.id}`, kind: 'habit', node, depth, groupId });
    }
    return out;
  };

  const out: TimelineSection[] = [
    {
      key: UNGROUPED_CONTAINER,
      groupId: null,
      droppable: true,
      rows: [...habitRows(sections.ungrouped, null), { key: 'add-habit-root', kind: 'add-habit', groupId: null }],
    },
  ];

  for (const section of sections.groups) {
    out.push({
      key: section.group.id,
      groupId: section.group.id,
      droppable: true,
      rows: [
        { key: `spacer-${section.group.id}`, kind: 'spacer' },
        { key: `group-${section.group.id}`, kind: 'group-header', group: section.group },
        ...habitRows(section.habits, section.group.id),
        { key: `add-habit-${section.group.id}`, kind: 'add-habit', groupId: section.group.id },
      ],
    });
  }

  out.push({
    key: 'timeline-tail',
    groupId: null,
    droppable: false,
    rows: [
      { key: 'spacer-add-group', kind: 'spacer' },
      { key: 'add-group', kind: 'add-group' },
    ],
  });

  return out;
}

/** Everything the shared DndContext can address: habit rows and group headers. */
export function timelineSortableIds(rows: TimelineRow[]): string[] {
  return rows.flatMap((row) => (row.kind === 'habit' ? [row.node.id] : row.kind === 'group-header' ? [row.group.id] : []));
}
