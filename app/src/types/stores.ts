/** Store domain types: optimistic mutation shapes shared by the Zustand stores. */

export interface OptimisticOp<T extends { id: string }> {
  // Apply the optimistic change to the working set.
  apply: (state: T[]) => T[];
  // State before the change; revert restores entities from it.
  snapshot: T[];
  // State right after the change; revert leaves alone anything that no longer matches it.
  next: T[];
}

export interface RunOptimisticOptions<T extends { id: string }, R> {
  state: T[];
  apply: (state: T[]) => T[];
  call: () => Promise<R>;
  // Called with the next state after applying optimistically.
  onApply?: (next: T[]) => void;
  // Called once the API call fails, with a function that undoes this change on the current state.
  onRevert?: (revert: (current: T[]) => T[]) => void;
  // Called with the API result on success.
  onSuccess?: (result: R) => void;
}
