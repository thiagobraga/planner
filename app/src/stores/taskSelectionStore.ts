import { create } from 'zustand';

interface TaskSelectionState {
  selectedTaskIds: Set<string>;
  selectTask: (id: string, isMulti: boolean) => void;
  toggleTask: (id: string) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useTaskSelectionStore = create<TaskSelectionState>((set, get) => ({
  selectedTaskIds: new Set<string>(),
  selectTask: (id, isMulti) =>
    set((state) => {
      if (isMulti || state.selectedTaskIds.size > 1) {
        const next = new Set(state.selectedTaskIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedTaskIds: next };
      }
      if (state.selectedTaskIds.has(id)) {
        return { selectedTaskIds: new Set() };
      }
      return { selectedTaskIds: new Set([id]) };
    }),
  toggleTask: (id) =>
    set((state) => {
      const next = new Set(state.selectedTaskIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedTaskIds: next };
    }),
  clearSelection: () => set({ selectedTaskIds: new Set() }),
  isSelected: (id) => get().selectedTaskIds.has(id),
}));
