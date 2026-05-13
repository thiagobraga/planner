// Pure helpers for optimistic mutations against an array of entities.
// Each operation captures a snapshot for revert and a "commit" step on success.

export interface OptimisticOp<T extends { id: string }> {
  // Apply the optimistic change to the working set.
  apply: (state: T[]) => T[];
  // Snapshot used by revert if the API call fails.
  snapshot: T[];
}

export function applyOptimistic<T extends { id: string }>(
  state: T[],
  apply: (state: T[]) => T[],
): { next: T[]; op: OptimisticOp<T> } {
  const snapshot = state;
  const next = apply(state);
  return { next, op: { apply, snapshot } };
}

export function revertOptimistic<T extends { id: string }>(op: OptimisticOp<T>): T[] {
  return op.snapshot;
}

// Replace a task in-place by id (or append if not found)
export function upsertById<T extends { id: string }>(state: T[], item: T): T[] {
  const idx = state.findIndex((s) => s.id === item.id);
  if (idx === -1) return [...state, item];
  const next = state.slice();
  next[idx] = item;
  return next;
}

export function removeById<T extends { id: string }>(state: T[], id: string): T[] {
  return state.filter((s) => s.id !== id);
}

export function patchById<T extends { id: string }>(state: T[], id: string, patch: Partial<T>): T[] {
  return state.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

// Runner: apply optimistic, await the API call, revert on failure within a budget.
export interface RunOptimisticOptions<T extends { id: string }, R> {
  state: T[];
  apply: (state: T[]) => T[];
  call: () => Promise<R>;
  // Called with the next state after applying optimistically.
  onApply?: (next: T[]) => void;
  // Called with the snapshot when revert is triggered (failure path).
  onRevert?: (snapshot: T[]) => void;
  // Called with the API result on success.
  onSuccess?: (result: R) => void;
  // Max ms to wait for the API call before treating it as failed (default 2000).
  revertTimeoutMs?: number;
}

export async function runOptimistic<T extends { id: string }, R>(opts: RunOptimisticOptions<T, R>): Promise<R> {
  const { state, apply, call, onApply, onRevert, onSuccess, revertTimeoutMs = 2000 } = opts;
  const { next, op } = applyOptimistic(state, apply);
  onApply?.(next);

  const timeoutPromise = new Promise<R>((_, reject) => {
    setTimeout(() => reject(new Error("OPTIMISTIC_TIMEOUT")), revertTimeoutMs);
  });

  try {
    const result = await Promise.race([call(), timeoutPromise]);
    onSuccess?.(result);
    return result;
  } catch (err) {
    onRevert?.(revertOptimistic(op));
    throw err;
  }
}
