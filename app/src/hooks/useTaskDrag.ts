import { useCallback, useRef, useState } from 'react';
import type {
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { usePlannerDrag, usePlannerDragHandlers } from '../contexts/PlannerDragContext';
import { flattenTasks, getSubtreeBlock, projectMove, type FlatRow } from '../utils/taskProjection';
import { apiMoveTask, type TaskOrderScope } from '../api/client';
import { trackMove } from '../utils/moveEcho';
import type { CollectionDropData, DayDropData, TaskDragData } from '../types/drag';
import type { Task } from '../components/TaskItem';

/**
 * Normalise an API date to the bare `YYYY-MM-DD` the page models use.
 *
 * The API returns a full timestamp (`2026-07-18T00:00:00.000Z`). Daily buckets
 * rows by matching the date against `^\d{4}-\d{2}-\d{2}$` and falls back to
 * *today* when it does not match, so patching a raw timestamp straight into a
 * task silently collapses it - and every sibling returned alongside it - into
 * today's section.
 */
function toISODate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

interface UseTaskDragOptions {
  /** Current rows, flat and unordered; the hook builds the tree itself. */
  tasks: Task[];
  /** Apply an optimistic result, and restore a snapshot on failure. */
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
  /** The ordering scope a drop in this page's own list belongs to. */
  scope: TaskOrderScope;
  /** Called after a failed move so the page can refetch authoritative order. */
  onError?: () => void;
  /**
   * Called after a successful move, so the page can invalidate the *other* views
   * a move can reach into. A task dropped on a sidebar collection leaves this
   * page's list and joins one this page does not own; without this, navigating
   * there would serve a cache that never saw the move.
   */
  onMoved?: () => void;
}

/**
 * Turns a drag gesture over a task list into a structural move.
 *
 * Optimistic by design: the projected result is applied immediately and the
 * server response is authoritative only if it disagrees. A failed request
 * restores the pre-drag snapshot rather than leaving the row where the user
 * dropped it, because a silently-wrong order that survives reload is worse than
 * a visible snap-back.
 */
export function useTaskDrag({ tasks, setTasks, scope, onError, onMoved }: UseTaskDragOptions) {
  const { setOverlay, announce } = usePlannerDrag();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const offsetX = useRef(0);
  const snapshot = useRef<Task[] | null>(null);
  /** Last spoken hover target, so an unchanged projection is not repeated. */
  const lastPreview = useRef<string | null>(null);

  const rows = flattenTasks(tasks);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as TaskDragData | undefined;
      if (!data) return;
      const id = data.taskId;
      setActiveDragId(id);
      offsetX.current = 0;
      snapshot.current = tasks;
      lastPreview.current = null;

      const descendants = Math.max(0, data.subtreeIds.length - 1);
      const title = tasks.find((t) => t.id === id)?.title ?? '';
      setOverlay({ title, descendantCount: descendants });
      announce(
        descendants > 0
          ? `Picked up ${title} with ${descendants} subtask${descendants === 1 ? '' : 's'}.`
          : `Picked up ${title}.`,
      );
    },
    [tasks, setOverlay, announce],
  );

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    offsetX.current = event.delta.x;
  }, []);

  /**
   * Speak the target the row would land on if released now.
   *
   * Fires only when the hovered target changes, so this stays quiet during a
   * continuous pointer drag rather than narrating every frame.
   */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const active = event.active.data.current as TaskDragData | undefined;
      const over = event.over?.data.current as
        | TaskDragData
        | DayDropData
        | CollectionDropData
        | undefined;
      if (!active) return;

      if (!over) {
        if (lastPreview.current !== null) {
          lastPreview.current = null;
          announce('No drop target.');
        }
        return;
      }

      const move = resolveMove({ rows, active, over, offsetX: offsetX.current, scope });
      const message = move?.preview ?? 'That is not a valid place to drop this task.';
      if (lastPreview.current === message) return;
      lastPreview.current = message;
      announce(message);
    },
    [rows, scope, announce],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = event.active.data.current as TaskDragData | undefined;
      const over = event.over?.data.current as
        | TaskDragData
        | DayDropData
        | CollectionDropData
        | undefined;
      setActiveDragId(null);
      lastPreview.current = null;
      if (!active) return;

      const before = snapshot.current ?? tasks;
      snapshot.current = null;

      if (!over) {
        announce('Move cancelled.');
        return;
      }

      // A temporary row has no server id yet, so a move would be addressed to a
      // task the API has never seen.
      if (active.taskId.startsWith('temp-')) {
        announce('This task is still being created. Try again in a moment.');
        return;
      }

      const move = resolveMove({ rows, active, over, offsetX: offsetX.current, scope });
      if (!move) {
        announce('That is not a valid place to drop this task.');
        return;
      }

      setTasks(() => applyMoveLocally(before, active, move));

      // Ignore this move's own broadcast until the request settles; the optimistic
      // state is already ahead of it.
      const untrack = trackMove(active.subtreeIds);

      apiMoveTask(active.taskId, move.input)
        .then((res) => {
          // Patch authoritative depth, parent, collection, date and order from
          // the server - the projection is a prediction, not the source of truth.
          setTasks((prev) => {
            const byId = new Map([...res.moved, ...res.reordered].map((t) => [t.id, t]));
            return prev.map((t) => {
              const authoritative = byId.get(t.id);
              if (!authoritative) return t;
              return {
                ...t,
                parentTaskId: authoritative.parentTaskId ?? undefined,
                collectionId: authoritative.collectionId,
                dueDate: toISODate(authoritative.dueDate),
                orderValue: authoritative.orderValue,
                indent: authoritative.depth ?? t.indent,
              };
            });
          });
          announce(move.announcement);
          onMoved?.();
        })
        .catch(() => {
          setTasks(() => before);
          announce('Move failed. The task returned to its original position.');
          onError?.();
        })
        .finally(untrack);
    },
    [rows, tasks, scope, setTasks, announce, onError, onMoved],
  );

  const handleDragCancel = useCallback(() => {
    // Nothing to undo: the optimistic move is only applied on drop, and cancel
    // and end are mutually exclusive. So cancelling deliberately leaves task
    // state untouched rather than reassigning it - Escape puts the row back
    // exactly where it was, changing nothing.
    //
    // (Restoring here previously passed `() => snapshot.current` to the setter
    // and nulled the ref on the next line. React runs that updater later, by
    // which point it returned null and blanked the page.)
    snapshot.current = null;
    lastPreview.current = null;
    setActiveDragId(null);
  }, []);

  usePlannerDragHandlers('task', {
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  });

  return { activeDragId };
}

interface ResolvedMove {
  input: Parameters<typeof apiMoveTask>[1];
  parentTaskId: string | null;
  depth: number;
  /** Past tense, spoken once the move has committed. */
  announcement: string;
  /**
   * Present tense, spoken while the row hovers this target. A keyboard user
   * arrowing through positions never sees the overlay, so without this the
   * projected target is invisible to them until they commit the drop.
   */
  preview: string;
}

/**
 * Translate a drop target into the move the API should perform.
 *
 * Exported for tests: the preview strings are the only thing a screen-reader
 * user has to go on mid-drag, and jsdom gives dnd-kit zero-size rects, so a
 * driven keyboard drag never resolves a target there.
 */
export function resolveMove({
  rows,
  active,
  over,
  offsetX,
  scope,
}: {
  rows: FlatRow<Task>[];
  active: TaskDragData;
  over: TaskDragData | DayDropData | CollectionDropData;
  offsetX: number;
  scope: TaskOrderScope;
}): ResolvedMove | null {
  // Dropped on a sidebar collection: file it there, promote to top level, and
  // keep the due date so a dated task stays on its day and merely gains a
  // collection. Omitting dueDate entirely is what preserves it server-side.
  if (over.kind === 'collection') {
    return {
      input: {
        parentTaskId: null,
        collectionId: over.collectionId,
        scope: { kind: 'collection', collectionId: over.collectionId },
        position: Number.MAX_SAFE_INTEGER, // append; the server clamps
      },
      parentTaskId: null,
      depth: 0,
      announcement: 'Moved to collection.',
      preview: 'Drop to file in this collection.',
    };
  }

  // Dropped on an empty day section: append to that date.
  if (over.kind === 'day') {
    return {
      input: {
        parentTaskId: null,
        dueDate: over.date,
        scope: { kind: 'day', dueDate: over.date },
        position: Number.MAX_SAFE_INTEGER,
      },
      parentTaskId: null,
      depth: 0,
      announcement: `Moved to ${over.date}.`,
      preview: `Drop to move to ${over.date}.`,
    };
  }

  // Dropped on another task row.
  if (active.subtreeIds.includes(over.taskId)) return null;

  const overIndex = rows.findIndex((r) => r.id === over.taskId);
  if (overIndex === -1) return null;

  const projection = projectMove(rows, active.taskId, overIndex, offsetX);

  // On Daily the row underneath defines which day's ordering applies, so the
  // page's own scope is only a fallback for a target with no date of its own.
  const targetDay = scope.kind === 'day' ? (over.dueDate ?? scope.dueDate) : null;
  const crossesDay = targetDay !== null && targetDay !== active.dueDate;

  return {
    input: {
      parentTaskId: projection.parentId,
      ...(crossesDay ? { dueDate: targetDay } : {}),
      scope: targetDay ? { kind: 'day', dueDate: targetDay } : scope,
      position: projection.position,
    },
    parentTaskId: projection.parentId,
    depth: projection.depth,
    announcement: projection.parentId
      ? `Moved under ${rows.find((r) => r.id === projection.parentId)?.task.title ?? 'parent'}.`
      : 'Moved to top level.',
    preview: projection.parentId
      ? `Drop to place under ${rows.find((r) => r.id === projection.parentId)?.task.title ?? 'parent'}.`
      : 'Drop to place at top level.',
  };
}

/**
 * Apply the projected move to local state so the list settles immediately.
 *
 * Only the fields the move actually changes are written - completion, priority
 * and content are left alone, which is what lets a completed task keep its exact
 * dropped position among open ones.
 */
function applyMoveLocally(tasks: Task[], active: TaskDragData, move: ResolvedMove): Task[] {
  const rows = flattenTasks(tasks);
  const block = new Set(getSubtreeBlock(rows, active.taskId).map((r) => r.id));
  const rootDepthDelta = move.depth - (active.depth ?? 0);

  return tasks.map((task) => {
    if (task.id === active.taskId) {
      return {
        ...task,
        parentTaskId: move.parentTaskId ?? undefined,
        indent: move.depth,
        ...(move.input.collectionId ? { collectionId: move.input.collectionId } : {}),
        ...(move.input.dueDate !== undefined ? { dueDate: move.input.dueDate ?? undefined } : {}),
      };
    }
    if (block.has(task.id)) {
      // Descendants keep their parent links and relative depth.
      return {
        ...task,
        indent: Math.max(0, (task.indent ?? 0) + rootDepthDelta),
        ...(move.input.collectionId ? { collectionId: move.input.collectionId } : {}),
        ...(move.input.dueDate !== undefined ? { dueDate: move.input.dueDate ?? undefined } : {}),
      };
    }
    return task;
  });
}
