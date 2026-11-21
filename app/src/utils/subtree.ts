import type { LeafProgress, SubtreeItem, SubtreeRow } from '../types/detail';

function childrenByParent<T extends SubtreeItem>(items: T[]): Map<string, T[]> {
  const unique = new Map(items.map((item) => [item.id, item]));
  const byParent = new Map<string, T[]>();
  for (const item of unique.values()) {
    if (!item.parentTaskId) continue;
    const siblings = byParent.get(item.parentTaskId) ?? [];
    siblings.push(item);
    byParent.set(item.parentTaskId, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.orderValue - b.orderValue);
  return byParent;
}

/** The subtree under rootId in reading order; depth 0 is a direct child. */
export function flattenSubtree<T extends SubtreeItem>(rootId: string, items: T[]): SubtreeRow<T>[] {
  const byParent = childrenByParent(items);
  const rows: SubtreeRow<T>[] = [];
  const visited = new Set<string>([rootId]);
  const walk = (parentId: string, depth: number) => {
    for (const child of byParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      rows.push({ item: child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return rows;
}

/**
 * Unique actionable leaves under rootId: tasks without task children. The
 * root, notes and events never count, so an empty plan reads 0 of 0.
 */
export function leafProgress<T extends SubtreeItem>(rootId: string, items: T[]): LeafProgress {
  const rows = flattenSubtree(rootId, items).filter((row) => row.item.type === 'task');
  const parents = new Set(rows.map((row) => row.item.parentTaskId));
  const leaves = rows.filter((row) => !parents.has(row.item.id));
  return { done: leaves.filter((row) => row.item.isCompleted).length, total: leaves.length };
}

/** Direct child counts by parent id, for the "has its own subtasks" mark on card rows. */
export function countChildren<T extends SubtreeItem>(items: T[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of new Map(items.map((entry) => [entry.id, entry])).values()) {
    if (item.parentTaskId) counts.set(item.parentTaskId, (counts.get(item.parentTaskId) ?? 0) + 1);
  }
  return counts;
}

/** The subtree under rootId minus every branch that starts at an id in `skip`. */
export function subtreeWithout<T extends SubtreeItem>(rootId: string, items: T[], skip: ReadonlySet<string>): SubtreeRow<T>[] {
  const rows: SubtreeRow<T>[] = [];
  let skipBelow = Infinity;
  for (const row of flattenSubtree(rootId, items)) {
    if (row.depth <= skipBelow) skipBelow = Infinity;
    if (skipBelow !== Infinity) continue;
    if (skip.has(row.item.id)) {
      skipBelow = row.depth;
      continue;
    }
    rows.push(row);
  }
  return rows;
}

/** Ids shown inside embedded blocks: each embedded task and its whole subtree. */
export function embeddedCoverage<T extends SubtreeItem>(embedded: ReadonlySet<string>, items: T[]): Set<string> {
  const covered = new Set<string>();
  for (const id of embedded) {
    covered.add(id);
    for (const row of flattenSubtree(id, items)) covered.add(row.item.id);
  }
  return covered;
}
