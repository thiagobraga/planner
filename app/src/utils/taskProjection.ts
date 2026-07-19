// Tree-aware drag projection.
//
// The older helpers in `taskTree.ts` treat the tree as *implied* by a flat list
// plus an `indent` column, which is enough for Tab/Shift+Tab but cannot express
// a drag that lifts a whole subtree out of one list and drops it in another.
// Here `parentTaskId` is authoritative and `depth` is derived from it, so a move
// is described once - as a parent plus a sibling position - and the rendered
// indentation follows from that rather than the other way round.
//
// Everything in this file is pure: no dnd-kit, no React, no API types. That is
// what makes the projection rules exhaustively testable.

export const MAX_DEPTH = 5;

/** The page grid. One indent step of horizontal drag is one nesting level. */
export const INDENT_WIDTH = 24;

export interface TaskLike {
  id: string;
  parentTaskId?: string | null;
  orderValue?: number;
  createdAt?: string;
}

export interface FlatRow<T extends TaskLike = TaskLike> {
  task: T;
  id: string;
  parentId: string | null;
  depth: number;
}

/** Siblings order by their stored position; `createdAt` only breaks exact ties. */
function compareSiblings<T extends TaskLike>(a: T, b: T): number {
  const byOrder = (a.orderValue ?? 0) - (b.orderValue ?? 0);
  if (byOrder !== 0) return byOrder;
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

/**
 * Flatten tasks into the parent-first order they render in.
 *
 * Deliberately tolerant of malformed data, because real lists contain rows this
 * view cannot fully explain:
 *
 * - a task whose parent is absent (filtered out, on another page, deleted) is
 *   promoted to the root instead of vanishing - hiding a task the user can still
 *   reach elsewhere is worse than showing it at the wrong depth;
 * - a parent cycle left by legacy data is broken rather than followed, so the
 *   traversal cannot spin;
 * - every input task appears exactly once in the output.
 */
export function flattenTasks<T extends TaskLike>(tasks: T[]): FlatRow<T>[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childrenOf = new Map<string | null, T[]>();

  /** Walk up to a root, treating an unreachable or cyclic parent as null. */
  const rootedParent = (task: T): string | null => {
    const parentId = task.parentTaskId ?? null;
    if (parentId === null) return null;
    if (!byId.has(parentId)) return null; // orphan: promote rather than hide

    const seen = new Set<string>([task.id]);
    let cursor: string | null = parentId;
    while (cursor !== null) {
      if (seen.has(cursor)) return null; // cycle: break it at this node
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentTaskId ?? null;
    }
    return parentId;
  };

  for (const task of tasks) {
    const parentId = rootedParent(task);
    const bucket = childrenOf.get(parentId);
    if (bucket) bucket.push(task);
    else childrenOf.set(parentId, [task]);
  }

  const out: FlatRow<T>[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    const children = childrenOf.get(parentId);
    if (!children) return;
    for (const task of [...children].sort(compareSiblings)) {
      out.push({ task, id: task.id, parentId, depth });
      visit(task.id, depth + 1);
    }
  };
  visit(null, 0);

  return out;
}

/**
 * The contiguous `[root, ...descendants]` run for a dragged task.
 *
 * Because the list is parent-first, a subtree is always a single unbroken run
 * ending at the first row that is not deeper than the root - which is what lets
 * a drag move a parent and its children as one block.
 */
export function getSubtreeBlock<T extends TaskLike>(
  rows: FlatRow<T>[],
  id: string,
): FlatRow<T>[] {
  const start = rows.findIndex((r) => r.id === id);
  if (start === -1) return [];
  const rootDepth = rows[start]!.depth;
  let end = start + 1;
  while (end < rows.length && rows[end]!.depth > rootDepth) end++;
  return rows.slice(start, end);
}

/** Remove a subtree block without splitting it. */
export function removeBlock<T extends TaskLike>(
  rows: FlatRow<T>[],
  id: string,
): { rest: FlatRow<T>[]; block: FlatRow<T>[] } {
  const block = getSubtreeBlock(rows, id);
  const blockIds = new Set(block.map((r) => r.id));
  return { rest: rows.filter((r) => !blockIds.has(r.id)), block };
}

/**
 * Re-insert a block at `index`, re-rooting it at `parentId`/`depth`.
 *
 * Descendants keep their depth *relative* to the root, so reparenting a
 * three-level branch preserves its shape at the new location.
 */
export function insertBlock<T extends TaskLike>(
  rows: FlatRow<T>[],
  block: FlatRow<T>[],
  index: number,
  parentId: string | null,
  depth: number,
): FlatRow<T>[] {
  if (block.length === 0) return rows;
  const rootDepth = block[0]!.depth;
  const delta = depth - rootDepth;
  const rebased = block.map((row, i) => ({
    ...row,
    depth: row.depth + delta,
    // Only the root is reparented; the block's internal links are untouched.
    parentId: i === 0 ? parentId : row.parentId,
  }));
  const at = Math.max(0, Math.min(index, rows.length));
  return [...rows.slice(0, at), ...rebased, ...rows.slice(at)];
}

export interface Projection {
  /** Parent the dragged task would take. */
  parentId: string | null;
  /** Depth it would render at. */
  depth: number;
  /** Zero-based index among its new siblings - not the flat render index. */
  position: number;
}

/**
 * Where a drag would land: the vertical destination decides *between which rows*,
 * the horizontal offset decides *how deeply nested*.
 *
 * Depth is clamped to one level below the row above (you cannot skip a level)
 * and to MAX_DEPTH. Projecting into the dragged task's own subtree is impossible
 * by construction, because that block is removed before the neighbours are read.
 */
export function projectMove<T extends TaskLike>(
  rows: FlatRow<T>[],
  activeId: string,
  overIndex: number,
  offsetX: number,
): Projection {
  const { rest, block } = removeBlock(rows, activeId);
  if (block.length === 0) return { parentId: null, depth: 0, position: 0 };

  const at = Math.max(0, Math.min(overIndex, rest.length));
  const above = rest[at - 1] ?? null;
  const below = rest[at] ?? null;

  const dragDepth = block[0]!.depth + Math.round(offsetX / INDENT_WIDTH);
  // You may nest one level under the row above, no deeper; and you must be at
  // least as deep as the row below, or that row would be orphaned mid-list.
  const maxDepth = Math.min(above ? above.depth + 1 : 0, MAX_DEPTH);
  const minDepth = below ? below.depth : 0;
  const depth = Math.max(minDepth, Math.min(dragDepth, maxDepth));

  // The parent is the nearest row above sitting exactly one level shallower.
  let parentId: string | null = null;
  if (depth > 0) {
    for (let i = at - 1; i >= 0; i--) {
      const row = rest[i]!;
      if (row.depth === depth - 1) {
        parentId = row.id;
        break;
      }
    }
  }

  // Sibling index, counted among rows sharing the projected parent - the flat
  // index would be wrong wherever intervening rows have descendants.
  let position = 0;
  for (let i = 0; i < at; i++) {
    if (rest[i]!.parentId === parentId) position++;
  }

  return { parentId, depth, position };
}

/** Apply a projection, returning the reordered flat list. */
export function applyProjection<T extends TaskLike>(
  rows: FlatRow<T>[],
  activeId: string,
  overIndex: number,
  offsetX: number,
): { rows: FlatRow<T>[]; projection: Projection } {
  const projection = projectMove(rows, activeId, overIndex, offsetX);
  const { rest, block } = removeBlock(rows, activeId);
  const at = Math.max(0, Math.min(overIndex, rest.length));
  return {
    rows: insertBlock(rest, block, at, projection.parentId, projection.depth),
    projection,
  };
}
