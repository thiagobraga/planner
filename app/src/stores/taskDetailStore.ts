import { create } from 'zustand';
import type { DetailMode, OpenDetailsOptions, TaskDetailState } from '../types/detail';

/**
 * Imperative bridge to the one detail controller in AppShell. The URL
 * (`?task=<id>`) is the open state; this store only mirrors it and remembers
 * where focus returns, so rows, cards and menus can open details without
 * prop drilling through pages.
 */
export const useTaskDetailStore = create<TaskDetailState>(() => ({
  taskId: null,
  navigator: null,
  origin: null,
  focusRequest: 0,
  mode: 'full',
  leaveGuard: null,
}));

export function setDetailMode(mode: DetailMode): void {
  useTaskDetailStore.setState({ mode });
}

// Long enough for a second click to arrive, so a double-click renames the
// row instead of reflowing the page under the pointer by docking the panel.
export const OPEN_DELAY_MS = 220;
let pendingOpen: ReturnType<typeof setTimeout> | null = null;

export function cancelPendingOpen(): void {
  if (pendingOpen) clearTimeout(pendingOpen);
  pendingOpen = null;
}

/** False when an unsaved draft asked to stay and the user agreed. */
export function canLeaveDetails(): boolean {
  return useTaskDetailStore.getState().leaveGuard?.() ?? true;
}

export function openTaskDetails(taskId: string, options: OpenDetailsOptions = {}): void {
  cancelPendingOpen();
  const state = useTaskDetailStore.getState();
  if (!state.navigator) return;
  if (options.mode) setDetailMode(options.mode);
  if (state.taskId === taskId) {
    if (options.focusPanel) useTaskDetailStore.setState({ focusRequest: state.focusRequest + 1 });
    return;
  }
  if (!canLeaveDetails()) return;
  const origin = options.origin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useTaskDetailStore.setState({
    // Keep the first row as the place to return to while the user walks subtasks.
    origin: state.taskId && state.origin?.isConnected ? state.origin : origin,
    focusRequest: options.focusPanel ? state.focusRequest + 1 : state.focusRequest,
  });
  state.navigator.open(taskId, state.taskId !== null);
}

/** A plain click on a row or card: waits out a possible double-click when the panel is closed. */
export function scheduleOpenTaskDetails(taskId: string, origin: HTMLElement): void {
  cancelPendingOpen();
  if (useTaskDetailStore.getState().taskId) {
    openTaskDetails(taskId, { origin });
    return;
  }
  pendingOpen = setTimeout(() => {
    pendingOpen = null;
    openTaskDetails(taskId, { origin });
  }, OPEN_DELAY_MS);
}

export function closeTaskDetails(): void {
  cancelPendingOpen();
  const state = useTaskDetailStore.getState();
  if (!state.taskId || !state.navigator || !canLeaveDetails()) return;
  const origin = state.origin;
  state.navigator.close();
  useTaskDetailStore.setState({ origin: null });
  if (origin?.isConnected) requestAnimationFrame(() => origin.focus({ preventScroll: true }));
}
