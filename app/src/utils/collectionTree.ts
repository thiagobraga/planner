import { arrayMove } from '@dnd-kit/sortable';
import type { ApiCollection } from '../types/api';
import type { FlatCollection } from '../types/collections';

const INDENT = 22;
const MAX_DEPTH = 4; // backend enforces nesting depth of 4

// pl-3 (12px) base, then a flat 10px step per depth - the original depth-0->1 distance -
// so every level reads the same distance instead of the first step alone being narrower.
export const DEPTH_PADDING_CLASSES = ['pl-3', 'pl-[22px]', 'pl-[32px]', 'pl-[42px]', 'pl-[52px]'] as const;
// Indentation for the new-subcollection input: parent depth -> parent base + 10 px.
export const SUB_INPUT_PADDING_CLASSES = ['pl-[22px]', 'pl-[32px]', 'pl-[42px]', 'pl-[52px]', 'pl-[62px]'] as const;

const COLOR_SHADE_FAMILIES: Record<string, readonly string[]> = {
  '#c98079': ['#c98079', '#d56b64', '#cc8b85', '#d16d73'],
  '#d56b64': ['#d56b64', '#c98079', '#d16d73', '#cc8b85'],
  '#cc8b85': ['#cc8b85', '#b97a3a', '#ac918f', '#c98079'],
  '#d16d73': ['#d16d73', '#d56b64', '#d6c7b0', '#c2a29e'],
  '#65788a': ['#65788a', '#6fa0d5', '#adb9c1', '#7ea2d6'],
  '#6fa0d5': ['#6fa0d5', '#adb9c1', '#65788a', '#7ea2d6'],
  '#adb9c1': ['#adb9c1', '#6fa0d5', '#65788a', '#7ea2d6'],
  '#7ea2d6': ['#7ea2d6', '#a6cfc5', '#6fa0d5', '#65788a'],
  '#7dbfb2': ['#7dbfb2', '#d7db96', '#a6cfc5', '#b7bf4e'],
  '#d7db96': ['#d7db96', '#7dbfb2', '#b7bf4e', '#a6cfc5'],
  '#a6cfc5': ['#a6cfc5', '#7ea2d6', '#d7db96', '#7dbfb2'],
  '#b7bf4e': ['#b7bf4e', '#d7db96', '#7dbfb2', '#ac918f'],
  '#b97a3a': ['#b97a3a', '#cbd376', '#cc8b85', '#ac918f'],
  '#cbd376': ['#cbd376', '#b97a3a', '#ac918f', '#b7bf4e'],
  '#ac918f': ['#ac918f', '#bababa', '#b7bf4e', '#cbd376'],
  '#b08b8a': ['#b08b8a', '#c2a29e', '#d6c7b0', '#65788a'],
  '#c2a29e': ['#c2a29e', '#d6c7b0', '#b08b8a', '#d16d73'],
  '#d6c7b0': ['#d6c7b0', '#c2a29e', '#d16d73', '#b08b8a'],
  '#6f7780': ['#6f7780', '#bababa', '#ac918f', '#adb9c1'],
  '#bababa': ['#bababa', '#6f7780', '#ac918f', '#adb9c1'],
};

export function getHierarchicalColor(
  collectionId: string,
  parentId: string | null,
  collections: ApiCollection[],
  pendingParentUpdates: Map<string, string | null> = new Map(),
): string {
  const getParentId = (id: string) => {
    return pendingParentUpdates.has(id)
      ? pendingParentUpdates.get(id)!
      : (collections.find((p) => p.id === id)?.parentId ?? null);
  };

  const getOriginalColor = (id: string) => {
    return collections.find((p) => p.id === id)?.color ?? '#65788a';
  };

  let depth = 0;
  let currParentId = parentId;
  let lastId = collectionId;

  while (currParentId) {
    depth++;
    lastId = currParentId;
    currParentId = getParentId(currParentId);
  }

  const rootColor = getOriginalColor(lastId);
  const family = COLOR_SHADE_FAMILIES[rootColor] || [rootColor];
  return family[depth % family.length];
}

/** Sidebar order: position first, then name, so equal positions never fall back to fetch order. */
export function compareCollections(a: ApiCollection, b: ApiCollection): number {
  return a.orderValue - b.orderValue || a.name.localeCompare(b.name);
}

/** Visible children of one collection, in the same order as the sidebar tree. */
export function childCollectionsOf(collections: ApiCollection[], parentId: string): ApiCollection[] {
  return collections.filter((c) => c.parentId === parentId && !c.isArchived && !c.isInbox).sort(compareCollections);
}

// Flatten the visible (non-inbox, non-archived) collections into a depth-annotated,
// order-sorted list suitable for a single sortable list with indentation.
export function flattenCollections(collections: ApiCollection[]): FlatCollection[] {
  const visible = collections.filter((p) => !p.isArchived && !p.isInbox);
  const childrenOf = new Map<string | null, ApiCollection[]>();
  for (const p of visible) {
    const key = p.parentId && visible.some((v) => v.id === p.parentId) ? p.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(p);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) {
    list.sort(compareCollections);
  }
  const out: FlatCollection[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const p of childrenOf.get(parentId) ?? []) {
      out.push({ id: p.id, name: p.name, color: p.color, parentId, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function ancestorIds(flat: FlatCollection[], collectionId: string | null): Set<string> {
  const parentById = new Map(flat.map((item) => [item.id, item.parentId]));
  const ancestors = new Set<string>();
  let parentId = collectionId ? parentById.get(collectionId) : null;

  while (parentId) {
    ancestors.add(parentId);
    parentId = parentById.get(parentId) ?? null;
  }

  return ancestors;
}

export function visibleCollections(
  flat: FlatCollection[],
  collapsedIds: ReadonlySet<string>,
  revealedIds: ReadonlySet<string>,
): FlatCollection[] {
  const parentById = new Map(flat.map((item) => [item.id, item.parentId]));

  return flat.filter((item) => {
    let parentId = item.parentId;
    while (parentId) {
      if (collapsedIds.has(parentId) && !revealedIds.has(parentId)) return false;
      parentId = parentById.get(parentId) ?? null;
    }
    return true;
  });
}

export function reorderVisibleCollections(
  flat: FlatCollection[],
  visible: FlatCollection[],
  activeIndex: number,
  overIndex: number,
): FlatCollection[] {
  const reorderedVisible = arrayMove(visible, activeIndex, overIndex);
  const visibleIds = new Set(visible.map((item) => item.id));
  let visibleIndex = 0;

  return flat.map((item) => (
    visibleIds.has(item.id) ? reorderedVisible[visibleIndex++] : item
  ));
}

// Compute the projected parent/depth for the dragged item given the horizontal drag offset.
export function getProjection(
  items: FlatCollection[],
  activeId: string,
  overId: string,
  dragOffset: number,
) {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const newItems = arrayMove(items, activeIndex, overIndex);
  const prev = newItems[overIndex - 1];
  const next = newItems[overIndex + 1];
  const dragDepth = Math.round(dragOffset / INDENT);
  const projectedDepth = (items[activeIndex]?.depth ?? 0) + dragDepth;
  const maxDepth = Math.min(prev ? prev.depth + 1 : 0, MAX_DEPTH - 1);
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));

  let parentId: string | null = null;
  if (depth > 0 && prev) {
    if (depth === prev.depth) parentId = prev.parentId;
    else if (depth > prev.depth) parentId = prev.id;
    else {
      const ancestor = newItems
        .slice(0, overIndex)
        .reverse()
        .find((i) => i.depth === depth);
      parentId = ancestor?.parentId ?? null;
    }
  }
  return { depth, parentId };
}
