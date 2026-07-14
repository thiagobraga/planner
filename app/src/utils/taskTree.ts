// Phase 6 — Tree-aware indentation helpers.
//
// Tasks are rendered as a flat, visually-ordered array where each item carries
// an `indent` level. The parent/child tree is implied by order + indent: an
// item's parent is the nearest preceding item one level shallower. These pure
// helpers translate a Tab / Shift+Tab keypress into the concrete
// `{ indent, parentTaskId }` the API expects, plus the descendant range that
// must shift with the item.

export const MAX_INDENT = 5;

export interface TreeNode {
  id: string;
  indent?: number;
  projectId?: string;
}

/**
 * Compute the new indent level for a Tab (dir=1) or Shift+Tab (dir=-1).
 *
 * Follows the standard outliner model: Tab nests the item one level under the
 * item directly above it, but never deeper than that item's indent + 1 (so the
 * first child of a parent, or the first task in a list, is a no-op). Shift+Tab
 * promotes one level, bottoming out at 0.
 *
 * Returns the new indent, or `null` when the keypress is a no-op.
 */
export function computeIndent<T extends TreeNode>(
  tasks: T[],
  index: number,
  dir: 1 | -1,
): number | null {
  const current = tasks[index]?.indent ?? 0;

  if (dir === 1) {
    // First task in the list has nothing to nest under.
    if (index === 0) return null;
    const prevIndent = tasks[index - 1]?.indent ?? 0;
    const maxIndent = Math.min(prevIndent + 1, MAX_INDENT);
    const next = Math.min(current + 1, maxIndent);
    return next === current ? null : next;
  }

  // Shift+Tab
  if (current === 0) return null;
  return current - 1;
}

/**
 * The parent id for a task once it sits at `newIndent`: the nearest preceding
 * task exactly one level shallower. Returns `null` at the top level (indent 0)
 * or when no such ancestor exists.
 */
export function getParentCandidate<T extends TreeNode>(
  tasks: T[],
  index: number,
  newIndent: number,
): string | null {
  if (newIndent <= 0) return null;
  for (let i = index - 1; i >= 0; i--) {
    if ((tasks[i]?.indent ?? 0) === newIndent - 1) return tasks[i]!.id;
  }
  return null;
}

/**
 * Contiguous descendants of the task at `index`: the run of following tasks
 * whose indent is strictly greater, stopping at the first task at the same or
 * shallower level. Used to optimistically shift a subtree in the local view.
 */
export function getDescendants<T extends TreeNode>(tasks: T[], index: number): T[] {
  const baseIndent = tasks[index]?.indent ?? 0;
  const out: T[] = [];
  for (let i = index + 1; i < tasks.length; i++) {
    if ((tasks[i]?.indent ?? 0) <= baseIndent) break;
    out.push(tasks[i]!);
  }
  return out;
}

export interface IndentResult<T> {
  /** The list with the task (and its subtree) re-indented, or the original list unchanged. */
  tasks: T[];
  /** The new parent id to persist (`null` = top level). Only meaningful when `changed`. */
  parentTaskId: string | null;
  /** False when the keypress was a no-op — callers should skip the API call. */
  changed: boolean;
}

/**
 * Resolve a Tab / Shift+Tab on task `id` within a flat, visually-ordered list:
 * computes the new indent, the parent to persist, and optimistically shifts the
 * task's contiguous descendant subtree by the same delta.
 *
 * `sameProjectOnly` (for cross-project views like Daily/Upcoming/Search) makes
 * the operation a no-op when the structural parent belongs to a different
 * project, preventing a task from silently jumping projects.
 */
export function applyIndent<T extends TreeNode>(
  tasks: T[],
  id: string,
  dir: 1 | -1,
  opts?: { sameProjectOnly?: boolean },
): IndentResult<T> {
  const noop: IndentResult<T> = { tasks, parentTaskId: null, changed: false };

  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return noop;

  const current = tasks[index]!.indent ?? 0;
  const newIndent = computeIndent(tasks, index, dir);
  if (newIndent === null) return noop;

  const parentTaskId = getParentCandidate(tasks, index, newIndent);

  if (opts?.sameProjectOnly && parentTaskId) {
    const parent = tasks.find((t) => t.id === parentTaskId);
    if (parent && parent.projectId !== tasks[index]!.projectId) return noop;
  }

  const delta = newIndent - current;
  const descIds = new Set(getDescendants(tasks, index).map((d) => d.id));
  const next = tasks.map((t) => {
    if (t.id === id) return { ...t, indent: newIndent };
    if (descIds.has(t.id)) return { ...t, indent: Math.max(0, (t.indent ?? 0) + delta) };
    return t;
  });

  return { tasks: next, parentTaskId, changed: true };
}
