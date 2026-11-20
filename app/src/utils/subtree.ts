import type { TaskDetailItem } from '../contracts/taskDetail';
import type { SubtreeRow } from '../types/detail';

function childrenByParent(items: TaskDetailItem[]): Map<string, TaskDetailItem[]> {
  const unique = new Map(items.map((item) => [item.id, item]));
  const byParent = new Map<string, TaskDetailItem[]>();
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
export function flattenSubtree(rootId: string, items: TaskDetailItem[]): SubtreeRow[] {
  const byParent = childrenByParent(items);
  const rows: SubtreeRow[] = [];
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
export function leafProgress(rootId: string, items: TaskDetailItem[]): { done: number; total: number } {
  const rows = flattenSubtree(rootId, items).filter((row) => row.item.type === 'task');
  const parents = new Set(rows.map((row) => row.item.parentTaskId));
  const leaves = rows.filter((row) => !parents.has(row.item.id));
  return { done: leaves.filter((row) => row.item.isCompleted).length, total: leaves.length };
}
