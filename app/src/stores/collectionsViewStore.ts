import { create } from 'zustand';
import type { CollectionsViewState } from '../types/collections';

const EMPTY = { activeId: null, split: null } as const;

export const useCollectionsViewStore = create<CollectionsViewState>((set) => ({
  ...EMPTY,
  remember: (activeId) => set({ activeId }),
  setSplit: (split) => set({ split }),
  forget: (collectionId) => set((state) => ({
    activeId: state.activeId === collectionId ? null : state.activeId,
    split: state.split?.collectionId === collectionId ? null : state.split,
  })),
  reset: () => set({ ...EMPTY }),
}));
