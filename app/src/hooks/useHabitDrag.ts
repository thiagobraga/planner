import { useCallback, useRef, useState } from 'react';
import type {
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { usePlannerDrag, usePlannerDragHandlers } from '../contexts/PlannerDragContext';
import {
  flattenHabitRows,
  projectHabitMove,
  applyHabitProjection,
  type HabitProjection,
  type HabitRow,
} from '../utils/habitProjection';
import { buildHabitSections } from '../utils/habitTree';
import { createIndentTracker } from '../utils/dragIndent';
import {
  apiMoveHabit,
  apiMoveHabitGroup,
  type ApiHabit,
  type ApiHabitGroup,
} from '../api/client';
import { trackMove } from '../utils/moveEcho';
import type {
  HabitDragData,
  HabitGroupDragData,
  HabitSectionDropData,
} from '../types/drag';

/** Gap-based ordering, matching what the server writes on a move. */
const ORDER_GAP = 1000;

interface UseHabitDragOptions {
  habits: ApiHabit[];
  groups: ApiHabitGroup[];
  /** Apply an optimistic habit list, and restore a snapshot on failure. */
  setHabits: (next: ApiHabit[]) => void;
  /** Apply an optimistic group list, and restore a snapshot on failure. */
  setGroups: (next: ApiHabitGroup[]) => void;
  /** Called after a failed move so the page can refetch authoritative order. */
  onError?: () => void;
}

/**
 * Turns a drag over the habits page into a structural move.
 *
 * Optimistic like the task equivalent: the projected result is applied at once
 * and the server response is authoritative only where it disagrees. A failure
 * restores the pre-drag snapshot rather than leaving a habit somewhere the
 * server never agreed to put it.
 *
 * Handles both entity kinds the page owns - a habit and a habit group - because
 * they share one snapshot and one rollback path.
 */
export function useHabitDrag({
  habits,
  groups,
  setHabits,
  setGroups,
  onError,
}: UseHabitDragOptions) {
  const { setOverlay, announce } = usePlannerDrag();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const offsetX = useRef(0);
  const habitSnapshot = useRef<ApiHabit[] | null>(null);
  const groupSnapshot = useRef<ApiHabitGroup[] | null>(null);
  /** Last spoken hover target, so an unchanged projection is not repeated. */
  const lastPreview = useRef<string | null>(null);
  /** Nesting intent, rebased on each row so drift cannot accumulate. */
  const indent = useRef(createIndentTracker());
  const overRowId = useRef<string | null>(null);

  const rows = flattenHabitRows(buildHabitSections(habits, groups));

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as HabitDragData | HabitGroupDragData | undefined;
      if (!data) return;
      offsetX.current = 0;
      indent.current.reset();
      overRowId.current = null;
      habitSnapshot.current = habits;
      groupSnapshot.current = groups;
      lastPreview.current = null;

      if (data.kind === 'habit-group') {
        setActiveDragId(data.groupId);
        const group = groups.find((g) => g.id === data.groupId);
        const carried = habits.filter((h) => h.groupId === data.groupId).length;
        setOverlay({ title: group?.name ?? 'Group', descendantCount: carried });
        announce(`Picked up group ${group?.name ?? ''}.`);
        return;
      }

      setActiveDragId(data.habitId);
      const habit = habits.find((h) => h.id === data.habitId);
      const children = data.childIds.length;
      setOverlay({ title: habit?.name ?? '', descendantCount: children });
      announce(
        children > 0
          ? `Picked up ${habit?.name ?? ''} with ${children} sub-habit${children === 1 ? '' : 's'}.`
          : `Picked up ${habit?.name ?? ''}.`,
      );
    },
    [habits, groups, setOverlay, announce],
  );

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    indent.current.move(event.delta.x);
    offsetX.current = indent.current.offset();
  }, []);

  /**
   * Speak the target the row would land on if released now.
   *
   * Mirrors the task hook: a keyboard user never sees the overlay, so the
   * projected target has to be spoken rather than only shown. Fires when the
   * hovered target changes, and repeats nothing.
   */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const active = event.active.data.current as HabitDragData | HabitGroupDragData | undefined;
      const over = event.over?.data.current as
        | HabitDragData
        | HabitGroupDragData
        | HabitSectionDropData
        | undefined;
      if (!active) return;

      // Rebase nesting intent whenever the pointer reaches a different row, so
      // sideways drift on the way there is not read as a request to indent.
      const overRow = event.over ? String(event.over.id) : null;
      if (overRow !== overRowId.current) {
        overRowId.current = overRow;
        indent.current.enterRow();
        offsetX.current = indent.current.offset();
      }

      const speak = (message: string) => {
        if (lastPreview.current === message) return;
        lastPreview.current = message;
        announce(message);
      };

      if (!over) {
        speak('No drop target.');
        return;
      }

      if (active.kind === 'habit-group') {
        if (over.kind !== 'habit-group') {
          speak('That is not a valid place to drop this group.');
          return;
        }
        const target = groups.find((g) => g.id === over.groupId);
        speak(`Drop to place group ${target?.name ?? ''}.`);
        return;
      }

      if (over.kind === 'habit-section') {
        const target = groups.find((g) => g.id === over.groupId);
        speak(target ? `Drop to add to ${target.name}.` : 'Drop to add to this group.');
        return;
      }

      if (over.kind !== 'habit') {
        speak('That is not a valid place to drop this habit.');
        return;
      }

      const projection = rowProjection(rows, active.habitId, over.habitId, offsetX.current);
      if (!projection) {
        speak('That is not a valid place to drop this habit.');
        return;
      }
      if (projection.depth === 1 && active.childIds.length > 0) {
        speak('A habit with sub-habits cannot become a sub-habit.');
        return;
      }
      if (projection.parentId) {
        const parent = habits.find((h) => h.id === projection.parentId);
        speak(`Drop to place under ${parent?.name ?? 'parent'}.`);
        return;
      }
      speak('Drop to place at top level.');
    },
    [rows, habits, groups, announce],
  );

  const handleHabitDrop = useCallback(
    (active: HabitDragData, over: HabitDragData | HabitSectionDropData) => {
      const before = habitSnapshot.current ?? habits;
      habitSnapshot.current = null;

      // A temporary row has no server id yet, so a move would be addressed to a
      // habit the API has never seen.
      if (active.habitId.startsWith('temp-')) {
        announce('This habit is still being created. Try again in a moment.');
        return;
      }

      const projection =
        over.kind === 'habit-section'
          ? appendToSection(rows, active.habitId, over.groupId)
          : rowProjection(rows, active.habitId, over.habitId, offsetX.current);

      if (!projection) {
        announce('That is not a valid place to drop this habit.');
        return;
      }

      // A habit that already has sub-habits cannot become one itself. The
      // projection pins it to root depth, but a drop aimed squarely at a parent
      // row still has to be refused rather than quietly relocated.
      if (projection.depth === 1 && active.childIds.length > 0) {
        announce('A habit with sub-habits cannot become a sub-habit.');
        return;
      }

      setHabits(applyToHabits(before, rows, active.habitId, projection, over));

      const untrack = trackMove([active.habitId, ...active.childIds]);

      apiMoveHabit(active.habitId, {
        parentId: projection.parentId,
        groupId: projection.groupId,
        position: projection.position,
      })
        .then((res) => {
          const byId = new Map([...res.moved, ...res.reordered].map((h) => [h.id, h]));
          setHabits(
            before.map((h) => {
              const authoritative = byId.get(h.id);
              return authoritative ? { ...h, ...authoritative } : h;
            }),
          );
          announce(
            projection.parentId
              ? `Moved under ${habits.find((h) => h.id === projection.parentId)?.name ?? 'parent'}.`
              : projection.groupId
                ? `Moved into ${groups.find((g) => g.id === projection.groupId)?.name ?? 'group'}.`
                : 'Moved to ungrouped habits.',
          );
        })
        .catch(() => {
          setHabits(before);
          announce('Move failed. The habit returned to its original position.');
          onError?.();
        })
        .finally(untrack);
    },
    [rows, habits, groups, setHabits, announce, onError],
  );

  const handleGroupDrop = useCallback(
    (active: HabitGroupDragData, overGroupId: string) => {
      const before = groupSnapshot.current ?? groups;
      groupSnapshot.current = null;

      if (active.groupId.startsWith('temp-')) {
        announce('This group is still being created. Try again in a moment.');
        return;
      }

      const untrack = trackMove([active.groupId]);
      const ordered = [...before].sort((a, b) => a.orderValue - b.orderValue);
      const from = ordered.findIndex((g) => g.id === active.groupId);
      const to = ordered.findIndex((g) => g.id === overGroupId);
      if (from === -1 || to === -1 || from === to) {
        untrack();
        return;
      }

      const next = [...ordered];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      setGroups(next.map((g, i) => ({ ...g, orderValue: i * ORDER_GAP })));

      apiMoveHabitGroup(active.groupId, { position: to })
        .then((res) => {
          const byId = new Map(res.reordered.map((g) => [g.id, g]));
          setGroups(before.map((g) => byId.get(g.id) ?? g));
          announce(`Moved group ${moved?.name ?? ''}.`);
        })
        .catch(() => {
          setGroups(before);
          announce('Move failed. The group returned to its original position.');
          onError?.();
        })
        .finally(untrack);
    },
    [groups, setGroups, announce, onError],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = event.active.data.current as HabitDragData | HabitGroupDragData | undefined;
      const over = event.over?.data.current as
        | HabitDragData
        | HabitGroupDragData
        | HabitSectionDropData
        | undefined;
      setActiveDragId(null);
      lastPreview.current = null;
      if (!active) return;

      if (!over) {
        habitSnapshot.current = null;
        groupSnapshot.current = null;
        announce('Move cancelled.');
        return;
      }

      if (active.kind === 'habit-group') {
        if (over.kind === 'habit-group') handleGroupDrop(active, over.groupId);
        return;
      }

      if (over.kind === 'habit' || over.kind === 'habit-section') {
        handleHabitDrop(active, over);
      }
    },
    [handleHabitDrop, handleGroupDrop, announce],
  );

  const handleDragCancel = useCallback(() => {
    // Nothing to undo: the optimistic move is applied on drop, and cancel and
    // end are mutually exclusive.
    habitSnapshot.current = null;
    groupSnapshot.current = null;
    lastPreview.current = null;
    setActiveDragId(null);
  }, []);

  const handlers = {
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  };

  usePlannerDragHandlers('habit', handlers);
  usePlannerDragHandlers('habit-group', handlers);

  return { activeDragId };
}

/** Projection for a drop onto another habit row. */
function rowProjection(
  rows: HabitRow[],
  activeId: string,
  overId: string,
  offsetX: number,
): HabitProjection | null {
  const overIndex = rows.findIndex((r) => r.id === overId);
  if (overIndex === -1) return null;
  return projectHabitMove(rows, activeId, overIndex, offsetX);
}

/**
 * Projection for a drop onto a section rather than a row: append as the last
 * root of that scope. This is the only way to reach an empty group.
 */
function appendToSection(
  rows: HabitRow[],
  activeId: string,
  groupId: string | null,
): HabitProjection | null {
  if (!rows.some((r) => r.id === activeId)) return null;
  const siblings = rows.filter((r) => r.id !== activeId && r.depth === 0 && r.groupId === groupId);
  return { parentId: null, groupId, depth: 0, position: siblings.length };
}

/**
 * Fold a projection back into the flat habit list.
 *
 * Order values are rewritten from the projected row order so the list settles
 * immediately; the server's own values overwrite these as soon as it answers.
 */
function applyToHabits(
  habits: ApiHabit[],
  rows: HabitRow[],
  activeId: string,
  projection: HabitProjection,
  over: HabitDragData | HabitSectionDropData,
): ApiHabit[] {
  const overIndex =
    over.kind === 'habit' ? rows.findIndex((r) => r.id === over.habitId) : rows.length;
  const next = applyHabitProjection(rows, activeId, projection, overIndex);

  // Re-number each sibling scope independently: roots by group, children by parent.
  const counters = new Map<string, number>();
  const orderOf = (row: HabitRow) => {
    const scope = row.parentId ?? `group:${row.groupId ?? 'none'}`;
    const at = counters.get(scope) ?? 0;
    counters.set(scope, at + 1);
    return at * ORDER_GAP;
  };
  const patched = new Map(next.map((row) => [row.id, { row, orderValue: orderOf(row) }]));

  return habits.map((habit) => {
    const entry = patched.get(habit.id);
    if (!entry) return habit;
    return {
      ...habit,
      parentId: entry.row.parentId,
      groupId: entry.row.groupId,
      orderValue: entry.orderValue,
    };
  });
}
