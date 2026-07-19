import { pointerWithin, closestCenter, type CollisionDetection } from '@dnd-kit/core';
import type { DragData, DropData, DragKind, DropKind } from '../../types/drag';

/**
 * Which drop kinds each drag kind is allowed to land on.
 *
 * One DndContext now holds tasks, habits, groups and collections at once, so
 * without this filter a task drag would collide with habit rows and a collection
 * drag would try to reparent itself into a Daily section.
 */
const ALLOWED_TARGETS: Record<DragKind, ReadonlySet<DropKind>> = {
  task: new Set<DropKind>(['task', 'day', 'collection']),
  habit: new Set<DropKind>(['habit', 'habit-section']),
  // A group reorders against other group headers; it is never filed into a
  // section, least of all its own.
  'habit-group': new Set<DropKind>(['habit-group']),
  // Collections reorder among themselves; they are never filed into a day or task.
  collection: new Set<DropKind>(['collection']),
};

/** Containers are regions; rows are points on a list. They resolve differently. */
const CONTAINER_KINDS: ReadonlySet<DropKind> = new Set<DropKind>(['day', 'collection', 'habit-section']);

/**
 * A sidebar collection row plays both parts, depending on what is being dragged.
 *
 * To a task it is a container - a place to be filed into, claimed only when the
 * pointer is really inside it. To another collection it is a row in a sortable
 * list, and must resolve by closest-center or reordering loses its midpoint
 * crossing behaviour and stalls whenever the pointer leaves the row.
 */
function containerKindsFor(activeKind: DragKind): ReadonlySet<DropKind> {
  if (activeKind === 'collection') {
    return new Set([...CONTAINER_KINDS].filter((k) => k !== 'collection'));
  }
  return CONTAINER_KINDS;
}

/**
 * Type-aware collision detection.
 *
 * Containers are resolved by pointer intersection, because a Daily section or a
 * sidebar collection row should only claim the drag when the pointer is actually
 * inside it. Sortable rows are resolved by closest-center, which gives the
 * steady midpoint-crossing behaviour a reorder list needs and does not flicker
 * when the pointer sits in the gap between two rows.
 *
 * Rows win when both match: dropping onto a task inside a day section means
 * "next to that task", not "somewhere in that day".
 */
export const plannerCollisionDetection: CollisionDetection = (args) => {
  const activeData = args.active.data.current as DragData | undefined;
  if (!activeData) return closestCenter(args);

  const allowed = ALLOWED_TARGETS[activeData.kind];

  const candidates = args.droppableContainers.filter((container) => {
    const data = container.data.current as DropData | undefined;
    if (!data) return false;
    if (!allowed.has(data.kind)) return false;
    // A task cannot be dropped into its own subtree - that would orphan the
    // block being carried. Filtering here means the invalid row never lights up.
    //
    // Descendants only: the dragged row stays a candidate for itself. subtreeIds
    // leads with the dragged id, and excluding that too left the row unable to
    // be its own drop target, so the nearest *other* row won from the first
    // frame of the drag - dragging the last row in a list made it swap with the
    // row above before the pointer had moved at all.
    if (activeData.kind === 'task' && data.kind === 'task') {
      const descendants = activeData.subtreeIds.slice(1);
      return !descendants.includes(data.taskId);
    }
    return true;
  });

  const containerKinds = containerKindsFor(activeData.kind);
  const rows = candidates.filter((c) => {
    const data = c.data.current as DropData | undefined;
    return data ? !containerKinds.has(data.kind) : false;
  });
  const containers = candidates.filter((c) => {
    const data = c.data.current as DropData | undefined;
    return data ? containerKinds.has(data.kind) : false;
  });

  const rowHits = rows.length ? closestCenter({ ...args, droppableContainers: rows }) : [];
  if (rowHits.length > 0) return rowHits;

  const containerHits = containers.length
    ? pointerWithin({ ...args, droppableContainers: containers })
    : [];
  if (containerHits.length > 0) return containerHits;

  // Nothing under the pointer: fall back to the nearest allowed target so a drag
  // released just outside a list still resolves instead of silently cancelling.
  return candidates.length ? closestCenter({ ...args, droppableContainers: candidates }) : [];
};
