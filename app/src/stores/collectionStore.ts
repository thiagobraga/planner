import { create } from 'zustand';
import { paletteColorHex, type ApiCollection } from '../api/client';

export interface CollectionTreeNode {
  id: string;
  name: string;
  color: string; // resolved hex for display
  colorName: string; // palette name for the API
  parentId: string | null;
  orderValue: number;
  isInbox: boolean;
  children: CollectionTreeNode[];
}

interface CollectionState {
  collections: ApiCollection[];
  setCollections: (collections: ApiCollection[]) => void;
  addCollection: (collection: ApiCollection) => void;
  updateCollection: (id: string, updates: Partial<ApiCollection>) => void;
  removeCollection: (id: string) => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  collections: [],
  setCollections: (collections) => set({ collections }),
  addCollection: (collection) => set((state) => ({ collections: [...state.collections, collection] })),
  updateCollection: (id, updates) =>
    set((state) => ({
      collections: state.collections.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeCollection: (id) => set((state) => ({ collections: state.collections.filter((p) => p.id !== id) })),
}));

// Build a nested, order-sorted tree from the flat collection list. Inbox and
// archived collections are excluded - Inbox has its own top-level nav item.
export function buildCollectionTree(collections: ApiCollection[]): CollectionTreeNode[] {
  const visible = collections.filter((p) => !p.isArchived && !p.isInbox);
  const byId = new Map<string, CollectionTreeNode>();
  visible.forEach((p) =>
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      color: paletteColorHex(p.color),
      colorName: p.color,
      parentId: p.parentId,
      orderValue: p.orderValue,
      isInbox: p.isInbox,
      children: [],
    }),
  );

  const roots: CollectionTreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const sortRec = (nodes: CollectionTreeNode[]) => {
    nodes.sort((a, b) => a.orderValue - b.orderValue || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
