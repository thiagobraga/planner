import { describe, expect, it } from 'vitest';
import {
  coerceRange,
  isRangeAvailable,
  rangeForShortcut,
  rangeShortcut,
  rangesFor,
  resolveRange,
  shiftAnchor,
} from '../viewRange';

// Wednesday.
const ANCHOR = '2026-10-07';

describe('rangesFor', () => {
  it('offers named presets to List and Table', () => {
    const presets = ['today', 'tomorrow', 'week', 'next7', 'upcoming', 'month'];
    expect(rangesFor('list')).toEqual(presets);
    expect(rangesFor('table')).toEqual(presets);
  });

  it('offers days and weeks to Columns, plus Month to Calendar', () => {
    const spans = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'w1', 'w2', 'w3'];
    expect(rangesFor('columns')).toEqual(spans);
    expect(rangesFor('calendar')).toEqual([...spans, 'month']);
  });

  it('knows which ranges a layout accepts', () => {
    expect(isRangeAvailable('columns', 'month')).toBe(false);
    expect(isRangeAvailable('calendar', 'month')).toBe(true);
    expect(isRangeAvailable('list', 'd3')).toBe(false);
  });
});

describe('coerceRange', () => {
  it('keeps a range the layout accepts', () => {
    expect(coerceRange('columns', 'd3')).toBe('d3');
    expect(coerceRange('list', 'upcoming')).toBe('upcoming');
  });

  it('moves presets to the closest span', () => {
    expect(coerceRange('columns', 'today')).toBe('d1');
    expect(coerceRange('columns', 'tomorrow')).toBe('d1');
    expect(coerceRange('columns', 'week')).toBe('w1');
    expect(coerceRange('columns', 'next7')).toBe('w1');
    expect(coerceRange('columns', 'upcoming')).toBe('w3');
    expect(coerceRange('columns', 'month')).toBe('w3');
    expect(coerceRange('calendar', 'month')).toBe('month');
  });

  it('moves spans to the closest preset', () => {
    expect(coerceRange('list', 'd1')).toBe('today');
    expect(coerceRange('list', 'd4')).toBe('next7');
    expect(coerceRange('list', 'w1')).toBe('week');
    expect(coerceRange('list', 'w3')).toBe('upcoming');
  });
});

describe('resolveRange', () => {
  it('resolves single days from the anchor', () => {
    expect(resolveRange('today', ANCHOR, 'sunday')).toEqual({ from: ANCHOR, to: ANCHOR, hideEmptyDays: false });
    expect(resolveRange('d1', ANCHOR, 'sunday')).toEqual({ from: ANCHOR, to: ANCHOR, hideEmptyDays: false });
    expect(resolveRange('tomorrow', ANCHOR, 'sunday')).toEqual({ from: '2026-10-08', to: '2026-10-08', hideEmptyDays: false });
  });

  it('resolves day spans starting at the anchor', () => {
    expect(resolveRange('d3', ANCHOR, 'sunday')).toMatchObject({ from: ANCHOR, to: '2026-10-09' });
    expect(resolveRange('next7', ANCHOR, 'sunday')).toMatchObject({ from: ANCHOR, to: '2026-10-13' });
  });

  it('aligns weeks to the week start', () => {
    expect(resolveRange('week', ANCHOR, 'sunday')).toMatchObject({ from: '2026-10-04', to: '2026-10-10' });
    expect(resolveRange('w1', ANCHOR, 'monday')).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
    expect(resolveRange('w3', ANCHOR, 'sunday')).toMatchObject({ from: '2026-10-04', to: '2026-10-24' });
  });

  it('covers the whole month, leap years included', () => {
    expect(resolveRange('month', ANCHOR, 'sunday')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(resolveRange('month', '2024-02-10', 'sunday')).toMatchObject({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('looks 42 days ahead for Upcoming and hides empty days', () => {
    expect(resolveRange('upcoming', ANCHOR, 'sunday')).toEqual({ from: ANCHOR, to: '2026-11-17', hideEmptyDays: true });
  });

  it('never asks the API for more than 42 days', () => {
    for (const range of [...rangesFor('list'), ...rangesFor('calendar')]) {
      const { from, to } = resolveRange(range, ANCHOR, 'sunday');
      const days = (Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8))) / 86_400_000 + 1;
      expect(days).toBeLessThanOrEqual(42);
    }
  });
});

describe('shiftAnchor', () => {
  it('moves by the length of the range', () => {
    expect(shiftAnchor('today', ANCHOR, 1)).toBe('2026-10-08');
    expect(shiftAnchor('d3', ANCHOR, -1)).toBe('2026-10-04');
    expect(shiftAnchor('week', ANCHOR, 1)).toBe('2026-10-14');
    expect(shiftAnchor('w2', ANCHOR, 1)).toBe('2026-10-21');
    expect(shiftAnchor('upcoming', ANCHOR, 1)).toBe('2026-11-18');
  });

  it('moves months to the first of the next month', () => {
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftAnchor('month', '2026-01-31', -1)).toBe('2025-12-01');
  });
});

describe('shortcuts', () => {
  it('labels ranges with the key after v', () => {
    expect(rangeShortcut('today')).toBe('1');
    expect(rangeShortcut('d4')).toBe('4');
    expect(rangeShortcut('week')).toBe('w');
    expect(rangeShortcut('w1')).toBe('w');
    expect(rangeShortcut('month')).toBe('m');
    expect(rangeShortcut('tomorrow')).toBeNull();
    expect(rangeShortcut('w2')).toBeNull();
  });

  it('maps a key to the range of the current layout', () => {
    expect(rangeForShortcut('list', '1')).toBe('today');
    expect(rangeForShortcut('columns', '1')).toBe('d1');
    expect(rangeForShortcut('list', 'w')).toBe('week');
    expect(rangeForShortcut('columns', 'w')).toBe('w1');
    expect(rangeForShortcut('columns', '5')).toBe('d5');
    expect(rangeForShortcut('list', '5')).toBeNull();
    expect(rangeForShortcut('columns', 'm')).toBeNull();
    expect(rangeForShortcut('list', 'm')).toBe('month');
  });
});
