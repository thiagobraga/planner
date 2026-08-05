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
      // If holding Ctrl/Cmd or already in multi-select mode (more than 1 selected or clicking selected item), toggle selection
      if (isMulti || state.selectedTaskIds.size > 0) {
        const next = new Set(state.selectedTaskIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedTaskIds: next };
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
