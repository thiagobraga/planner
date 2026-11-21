import { create } from 'zustand';

type PageShortcutHandler = (action: string) => void;

interface PageShortcutsState {
  handler: PageShortcutHandler | null;
  stack: PageShortcutHandler[];
  /** Pushes `handler` onto the active stack; releasing restores the previous handler if any. */
  register: (handler: PageShortcutHandler) => () => void;
}

export const usePageShortcutsStore = create<PageShortcutsState>((set) => ({
  handler: null,
  stack: [],
  register: (handler) => {
    set((state) => {
      const stack = [...state.stack, handler];
      return { stack, handler };
    });
    return () => {
      set((state) => {
        const idx = state.stack.lastIndexOf(handler);
        if (idx === -1) return state;
        const stack = [...state.stack.slice(0, idx), ...state.stack.slice(idx + 1)];
        return { stack, handler: stack[stack.length - 1] ?? null };
      });
    };
  },
}));

/** AppShell hands `view:*` actions to whichever page is showing. */
export function runPageShortcut(action: string): void {
  usePageShortcutsStore.getState().handler?.(action);
}
