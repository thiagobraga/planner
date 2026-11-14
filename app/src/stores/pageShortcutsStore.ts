import { create } from 'zustand';

type PageShortcutHandler = (action: string) => void;

interface PageShortcutsState {
  handler: PageShortcutHandler | null;
  /** Makes `handler` the page's; returns a release that only clears it if still current. */
  register: (handler: PageShortcutHandler) => () => void;
}

export const usePageShortcutsStore = create<PageShortcutsState>((set, get) => ({
  handler: null,
  register: (handler) => {
    set({ handler });
    return () => {
      if (get().handler === handler) set({ handler: null });
    };
  },
}));

/** AppShell hands `view:*` actions to whichever page is showing. */
export function runPageShortcut(action: string): void {
  usePageShortcutsStore.getState().handler?.(action);
}
