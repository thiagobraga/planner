import { describe, it, expect } from 'vitest';
import { createIndentTracker } from '../dragIndent';
import { INDENT_WIDTH } from '../taskProjection';

/** How many nesting levels an offset would request. */
const levels = (offset: number) => Math.round(offset / INDENT_WIDTH);

describe('createIndentTracker', () => {
  it('reports no intent when the pointer only travels vertically', () => {
    const tracker = createIndentTracker();
    tracker.move(0);
    tracker.enterRow();
    tracker.move(0);

    expect(tracker.offset()).toBe(0);
  });

  it('ignores drift accumulated on the way to the current row', () => {
    // The reported failure: a long drag down the page drifts ~90px sideways,
    // which the old reading turned into four levels of nesting.
    const tracker = createIndentTracker();
    tracker.move(30);
    tracker.move(60);
    tracker.move(90);
    tracker.enterRow(); // arrived at the destination row, 90px of drift behind us

    expect(levels(tracker.offset())).toBe(0);
  });

  it('still reports intent gestured after arriving', () => {
    const tracker = createIndentTracker();
    tracker.move(90);
    tracker.enterRow();
    tracker.move(90 + INDENT_WIDTH);

    expect(levels(tracker.offset())).toBe(1);
  });

  it('rebases again on each new row, so intent never compounds', () => {
    const tracker = createIndentTracker();
    for (const drift of [40, 80, 120, 160]) {
      tracker.move(drift);
      tracker.enterRow();
      expect(levels(tracker.offset())).toBe(0);
    }
  });

  it('reads leftward intent as outdenting', () => {
    const tracker = createIndentTracker();
    tracker.move(0);
    tracker.enterRow();
    tracker.move(-INDENT_WIDTH);

    expect(levels(tracker.offset())).toBe(-1);
  });

  it('forgets the previous drag on reset', () => {
    const tracker = createIndentTracker();
    tracker.move(200);
    tracker.enterRow();
    tracker.move(260);
    tracker.reset();

    expect(tracker.offset()).toBe(0);
  });
});
