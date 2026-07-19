/**
 * Horizontal nesting intent, measured from the row the pointer is currently on.
 *
 * dnd-kit reports `delta.x` as total travel since pointer-down. Reading that as
 * nesting intent means a drag's horizontal drift accumulates over its whole
 * length, so a long vertical drag arrives asking for several levels of nesting
 * the user never gestured for - the further the drag, the deeper the accident.
 *
 * Rebasing on every new hovered row makes the intent local: what matters is how
 * far sideways the pointer moved *since reaching the row it is now over*, not
 * how far it wandered getting there.
 */
export interface IndentTracker {
  /** Record the drag's total horizontal delta, as dnd-kit reports it. */
  move(totalDeltaX: number): void;
  /** The pointer reached a different row; intent restarts from here. */
  enterRow(): void;
  /** Horizontal intent relative to the current row, in pixels. */
  offset(): number;
  /** Forget everything; call at the start of each drag. */
  reset(): void;
}

export function createIndentTracker(): IndentTracker {
  let baseline = 0;
  let latest = 0;

  return {
    move(totalDeltaX) {
      latest = totalDeltaX;
    },
    enterRow() {
      baseline = latest;
    },
    offset() {
      return latest - baseline;
    },
    reset() {
      baseline = 0;
      latest = 0;
    },
  };
}
