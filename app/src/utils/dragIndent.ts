import type { IndentTracker } from '../types/task';

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
