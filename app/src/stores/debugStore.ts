import { create } from 'zustand';

export const DEBUG_STORAGE_KEY = 'planner.debug.v1';

export function loadDebug(): boolean {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveDebug(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(DEBUG_STORAGE_KEY, '1');
    else localStorage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); debug mode then lasts the session.
  }
}

interface DebugState {
  enabled: boolean;
  toggle: () => void;
}

export const useDebugStore = create<DebugState>((set, get) => ({
  enabled: loadDebug(),
  toggle: () => {
    const enabled = !get().enabled;
    saveDebug(enabled);
    set({ enabled });
  },
}));
