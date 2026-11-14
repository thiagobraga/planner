import { useEffect, useRef } from 'react';
import { usePageShortcutsStore } from '../stores/pageShortcutsStore';

/** Lets the current page answer the `view:*` shortcuts while it is mounted. */
export function usePageShortcuts(handler: (action: string) => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => usePageShortcutsStore.getState().register((action) => latest.current(action)), []);
}
