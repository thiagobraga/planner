// Drag projection for the habit hierarchy.
//
// Habits are a shallower shape than tasks: exactly one level of nesting, and a
// second axis - the group - that tasks do not have. A root habit lives either in
// the ungrouped list or in exactly one named group; a sub-habit lives under a
// parent and inherits that parent's group rather than holding one of its own.
//
// So a habit move is described by three things at once - `parentId`, `groupId`
// and a sibling `position` - and this module derives all three from a vertical
// destination plus a horizontal offset. Like `taskProjection`, everything here is
// pure: no dnd-kit, no React, no API calls, which is what makes the rules
// exhaustively testable.

import type { HabitSections, HabitNode } from './habitTree';

/** The page grid. One indent step of horizontal drag is one nesting level. */
export const HABIT_INDENT_WIDTH = 24;

/** Droppable id for the section holding roots that belong to no group. */
export const UNGROUPED_CONTAINER = 'habits-ungrouped';

/** A habit hierarchy is one level deep, so depth is only ever root or child. */
export type HabitDepth = 0 | 1;

export interface HabitRow {
  id: string;
  name: string;
  /** Null for a root habit. */
  parentId: string | null;
  /** For a root, the group it sits in. A child inherits its parent's, so null. */
  groupId: string | null;
  depth: HabitDepth;
  /** The section this row renders in - a group id, or UNGROUPED_CONTAINER. */
  containerId: string;
  /** Sub-habits carried along by this root. Non-empty means it cannot become one. */
  childIds: string[];
}

/** The container id a root with this group belongs to. */
export function containerForGroup(groupId: string | null): string {
  return groupId ?? UNGROUPED_CONTAINER;
}

function rootRow(node: HabitNode, groupId: string | null): HabitRow {
  return {
    id: node.id,
    name: node.name,
    parentId: null,
    groupId,
    depth: 0,
    containerId: containerForGroup(groupId),
    childIds: node.children.map((c) => c.id),
  };
}

function childRow(node: HabitNode, parent: HabitRow): HabitRow {
  return {
    id: node.id,
    name: node.name,
    parentId: parent.id,
    // Deliberately null: group membership is inherited from the parent, and
    // storing a copy here would let the two drift apart after a group move.
    groupId: null,
    depth: 1,
    containerId: parent.containerId,
    childIds: [],
  };
}

/**
 * Flatten the rendered sections into one parent-first row list.
 *
 * Ungrouped roots come first, then each group in order, matching what the
 * timeline draws. A group with no habits contributes no rows - dropping into an
 * empty group is resolved by that section's own droppable, not by row projection.
 */
export function flattenHabitRows(sections: HabitSections): HabitRow[] {
  const out: HabitRow[] = [];

  const pushTree = (nodes: HabitNode[], groupId: string | null) => {
    for (const node of nodes) {
      const root = rootRow(node, groupId);
      out.push(root);
      for (const child of node.children) out.push(childRow(child, root));
    }
  };

  pushTree(sections.ungrouped, null);
  for (const section of sections.groups) pushTree(section.habits, section.group.id);

  return out;
}

/**
 * The contiguous `[root, ...children]` run for a dragged habit.
 *
 * A sub-habit is always a block of one. A root carries every child that follows
 * it, so dragging a parent moves its children with it and never splits them.
 */
export function getHabitBlock(rows: HabitRow[], id: string): HabitRow[] {
  const start = rows.findIndex((r) => r.id === id);
  if (start === -1) return [];
  if (rows[start]!.depth === 1) return [rows[start]!];
  let end = start + 1;
  while (end < rows.length && rows[end]!.depth === 1) end++;
  return rows.slice(start, end);
}

/** Remove a habit block without splitting a parent from its children. */
export function removeHabitBlock(
  rows: HabitRow[],
  id: string,
): { rest: HabitRow[]; block: HabitRow[] } {
  const block = getHabitBlock(rows, id);
  const ids = new Set(block.map((r) => r.id));
  return { rest: rows.filter((r) => !ids.has(r.id)), block };
}

/** A habit that already has sub-habits cannot itself become one. */
export function canBecomeSubHabit(rows: HabitRow[], id: string): boolean {
  const row = rows.find((r) => r.id === id);
  return row ? row.childIds.length === 0 : false;
}

export interface HabitProjection {
  /** The parent the habit would take; null when it lands as a root. */
  parentId: string | null;
  /** The group it would belong to; always null when it lands as a sub-habit. */
  groupId: string | null;
  depth: HabitDepth;
  /** Zero-based index among its new siblings - not the flat render index. */
  position: number;
}

/**
 * Where a habit drag would land.
 *
 * The vertical destination decides between which rows it falls; the horizontal
 * offset decides whether it lands as a root or as a sub-habit of the root above.
 *
 * Two clamps carry the hierarchy rules. A habit with children is pinned to root
 * depth and pushed past any children directly below it, so it can never be
 * nested and can never be dropped into the middle of somebody else's block. And
 * child depth requires a row above to attach to, so the very first position in
 * the list is always a root position.
 */
export function projectHabitMove(
  rows: HabitRow[],
  activeId: string,
  overIndex: number,
  offsetX: number,
): HabitProjection | null {
  const { rest, block } = removeHabitBlock(rows, activeId);
  if (block.length === 0) return null;

  const hasChildren = block.length > 1;
  let at = Math.max(0, Math.min(overIndex, rest.length));

  // A parent cannot be nested, so it must not come to rest between another
  // parent and its children either. Skip past that run rather than splitting it.
  if (hasChildren) {
    while (at < rest.length && rest[at]!.depth === 1) at++;
  }

  const above = rest[at - 1] ?? null;
  const below = rest[at] ?? null;

  const dragDepth = block[0]!.depth + Math.round(offsetX / HABIT_INDENT_WIDTH);
  // Child depth needs something above to attach to; a parent can never take it.
  const maxDepth: HabitDepth = hasChildren || !above ? 0 : 1;
  // Landing shallower than the row below would orphan it mid-block.
  const minDepth: HabitDepth = hasChildren ? 0 : ((below?.depth ?? 0) as HabitDepth);
  const depth = Math.max(minDepth, Math.min(dragDepth, maxDepth)) as HabitDepth;

  if (depth === 1 && above) {
    // Attach to the root above, or join the children of the child above.
    const parentId = above.depth === 0 ? above.id : above.parentId;
    if (!parentId) return null;

    let position = 0;
    for (let i = 0; i < at; i++) {
      if (rest[i]!.parentId === parentId) position++;
    }
    return { parentId, groupId: null, depth: 1, position };
  }

  // Landing as a root: the group is the one whose list it is joining. Prefer the
  // row being displaced downward - dropping *onto* a row means taking its place,
  // and so its group - and fall back to the row above at the end of a section.
  const anchor = below ?? above;
  const groupId = anchor ? anchorGroupId(anchor, rest) : null;

  let position = 0;
  for (let i = 0; i < at; i++) {
    const row = rest[i]!;
    if (row.depth === 0 && row.groupId === groupId) position++;
  }

  return { parentId: null, groupId, depth: 0, position };
}

/**
 * The group a row belongs to, following a child up to its parent.
 *
 * A child row carries `groupId: null` because it inherits, so reading it
 * directly would misreport a grouped parent's children as ungrouped.
 */
function anchorGroupId(row: HabitRow, rows: HabitRow[]): string | null {
  if (row.depth === 0) return row.groupId;
  const parent = rows.find((r) => r.id === row.parentId);
  return parent?.groupId ?? null;
}

/**
 * Apply a projection, returning the reordered rows.
 *
 * Used by the optimistic path so the list settles at the projected shape before
 * the server answers.
 */
export function applyHabitProjection(
  rows: HabitRow[],
  activeId: string,
  projection: HabitProjection,
  overIndex: number,
): HabitRow[] {
  const { rest, block } = removeHabitBlock(rows, activeId);
  if (block.length === 0) return rows;

  let at = Math.max(0, Math.min(overIndex, rest.length));
  if (block.length > 1) {
    while (at < rest.length && rest[at]!.depth === 1) at++;
  }

  const containerId = containerForGroup(projection.groupId);
  const [root, ...children] = block;
  const rebasedRoot: HabitRow = {
    ...root!,
    parentId: projection.parentId,
    groupId: projection.depth === 1 ? null : projection.groupId,
    depth: projection.depth,
    containerId:
      projection.depth === 1
        ? (rest.find((r) => r.id === projection.parentId)?.containerId ?? containerId)
        : containerId,
  };
  const rebasedChildren = children.map((c) => ({ ...c, containerId: rebasedRoot.containerId }));

  return [...rest.slice(0, at), rebasedRoot, ...rebasedChildren, ...rest.slice(at)];
}
