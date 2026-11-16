import { useEffect, useMemo } from 'react';
import { HabitBlockPreview } from '../components/habits/HabitBlockPreview';
import { HabitTimelineBlockPreview } from '../components/habits/HabitTimelineBlockPreview';
import { usePlannerDrag } from '../contexts/usePlannerDrag';
import type { DayColClass, TimelineDayCell } from '../types/habitTimeline';
import { HABIT_INDENT_WIDTH, flattenHabitRows, projectHabitMove } from '../utils/habitProjection';
import { findNodeWithDepth } from '../utils/habitTimeline';
import type { HabitSections } from '../utils/habitTree';

interface UseHabitTimelineDragOptions {
  sections: HabitSections;
  collapsed: ReadonlySet<string>;
  activeDragId?: string | null;
  days: TimelineDayCell[];
  dayColClass: DayColClass;
  labelColWidth: number;
}

/**
 * The timeline's side of a habit drag: where the insertion line goes, and what
 * the overlay draws under the pointer.
 *
 * The timeline is a two-column grid, so rows deliberately do not slide out of
 * the way - only the label column could move, and the day cells would fall out
 * of step. The insertion line previews the landing position instead.
 */
export function useHabitTimelineDrag({
  sections,
  collapsed,
  activeDragId,
  days,
  dayColClass,
  labelColWidth,
}: UseHabitTimelineDragOptions) {
  const { indentSteps, overId, setOverlayNode } = usePlannerDrag();

  const dragRows = useMemo(() => flattenHabitRows(sections), [sections]);
  const projection =
    activeDragId && overId && dragRows.some((r) => r.id === activeDragId)
      ? projectHabitMove(
          dragRows,
          activeDragId,
          Math.max(0, dragRows.findIndex((r) => r.id === overId)),
          indentSteps * HABIT_INDENT_WIDTH,
        )
      : null;

  // The row the line is drawn above: the first sibling at or after the projected
  // position within the target scope.
  const insertionBeforeId = useMemo(() => {
    if (!projection || !activeDragId) return null;
    const siblings = dragRows.filter(
      (row) =>
        row.id !== activeDragId &&
        (projection.parentId
          ? row.parentId === projection.parentId
          : row.depth === 0 && row.groupId === projection.groupId),
    );
    return siblings[projection.position]?.id ?? null;
  }, [projection, activeDragId, dragRows]);

  // What travels under the pointer: the dragged habit drawn as a whole row -
  // label, marks and all - together with the sub-habits it carries. A group
  // header has no day track of its own, so it lifts as its heading.
  const draggedBlock = useMemo(() => {
    if (!activeDragId) return null;

    const roots = [...sections.ungrouped, ...sections.groups.flatMap((s) => s.habits)];
    const found = findNodeWithDepth(roots, activeDragId);
    if (!found) return null;

    // A collapsed parent's sub-habits are not on screen, so they do not travel.
    const carried = collapsed.has(found.node.id) ? [] : found.node.children;
    return [found, ...carried.map((child) => ({ node: child, depth: found.depth + 1 }))];
  }, [sections, activeDragId, collapsed]);

  useEffect(() => {
    if (!activeDragId) return;

    if (!draggedBlock) {
      const group = sections.groups.find((s) => s.group.id === activeDragId);
      if (!group) return;
      setOverlayNode(
        <HabitBlockPreview name={group.group.name} icon={group.group.icon} count={group.habits.length} kind="habit-group" />,
      );
      return () => setOverlayNode(null);
    }

    setOverlayNode(
      <HabitTimelineBlockPreview rows={draggedBlock} days={days} dayColClass={dayColClass} labelColWidth={labelColWidth} />,
    );
    return () => setOverlayNode(null);
  }, [activeDragId, draggedBlock, sections, days, dayColClass, labelColWidth, setOverlayNode]);

  return { insertionBeforeId, insertionDepth: projection?.depth ?? 0 };
}
