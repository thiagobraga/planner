// Pure helpers for optimistic mutations against an array of entities.
// Each operation keeps the before and after states so a failure undoes only its own change.

import type { OptimisticOp, RunOptimisticOptions } from '../types/stores';

export function applyOptimistic<T extends { id: string }>(
  state: T[],
  apply: (state: T[]) => T[],
): { next: T[]; op: OptimisticOp<T> } {
  const snapshot = state;
  const next = apply(state);
  return { next, op: { apply, snapshot, next } };
}

// By value: a query cache may hold copies of the entities it was given.
function sameEntity<T extends { id: string }>(a: T, b: T): boolean {
  const keys = Object.keys(a) as Array<keyof T>;
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}

/**
 * Undo one operation on the current state. An entity goes back to its snapshot
 * only while it still looks the way this operation left it, so a newer edit,
 * or one to another entity, survives the rollback.
 */
export function revertOptimistic<T extends { id: string }>(op: OptimisticOp<T>, current: T[]): T[] {
  const before = new Map(op.snapshot.map((item) => [item.id, item]));
  const after = new Map(op.next.map((item) => [item.id, item]));
  const result: T[] = [];
  for (const item of current) {
    const applied = after.get(item.id);
    if (!applied || !sameEntity(item, applied)) result.push(item);
    else if (before.has(item.id)) result.push(before.get(item.id)!);
  }
  op.snapshot.forEach((item, index) => {
    if (after.has(item.id) || result.some((entry) => entry.id === item.id)) return;
    result.splice(Math.min(index, result.length), 0, item);
  });
  return result;
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

// Runner: apply optimistically, then keep or undo by the call's real outcome.
// No timer: a slow request that succeeds must never be shown as failed.
export async function runOptimistic<T extends { id: string }, R>(opts: RunOptimisticOptions<T, R>): Promise<R> {
  const { state, apply, call, onApply, onRevert, onSuccess } = opts;
  const { next, op } = applyOptimistic(state, apply);
  onApply?.(next);

  try {
    const result = await call();
    onSuccess?.(result);
    return result;
  } catch (err) {
    onRevert?.((current) => revertOptimistic(op, current));
    throw err;
  }
}
