import { describe, it, expect } from 'vitest';
import { nextOrderValue } from '../order';

/**
 * Order values are gap-based (`index * 1000`), so an appended row has to clear
 * the largest one present. Counting rows produced small numbers that sorted
 * *between* existing ones, which is how a note typed at the bottom of Daily
 * appeared near the top of the day instead.
 */

const rows = (...orderValues: number[]) => orderValues.map((orderValue) => ({ orderValue }));

/** Where an appended row lands once the list is sorted the way the pages sort it. */
function positionAfterAppend(existing: number[]): number {
  const appended = [...rows(...existing), { orderValue: nextOrderValue(rows(...existing)) }];
  const sorted = [...appended].sort((a, b) => a.orderValue - b.orderValue);
  return sorted.indexOf(appended[appended.length - 1]!);
}

describe('nextOrderValue', () => {
  it('sorts an appended row last, not into the middle', () => {
    // The reported case: two subtasks at 0, then rows at 1000 and 2000. Counting
    // rows gave 5, landing the new row second.
    expect(positionAfterAppend([0, 0, 1000, 2000])).toBe(4);
  });

  it('clears the largest value rather than the row count', () => {
    expect(nextOrderValue(rows(0, 0, 1000, 2000))).toBeGreaterThan(2000);
  });

  it('starts at zero for an empty list', () => {
    expect(nextOrderValue([])).toBe(0);
  });

  it('appends past a single row', () => {
    expect(positionAfterAppend([0])).toBe(1);
  });

  it('handles large sparse values, as a long-lived list accumulates', () => {
    expect(positionAfterAppend([0, 1000, 24000, 25000])).toBe(4);
  });

  it('leaves a gap, so the next insert need not renumber', () => {
    expect(nextOrderValue(rows(1000)) - 1000).toBe(1000);
  });
});
