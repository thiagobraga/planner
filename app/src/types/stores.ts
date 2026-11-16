/** Store domain types: optimistic mutation shapes shared by the Zustand stores. */

export interface OptimisticOp<T extends { id: string }> {
  // Apply the optimistic change to the working set.
  apply: (state: T[]) => T[];
  // Snapshot used by revert if the API call fails.
  snapshot: T[];
}

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
