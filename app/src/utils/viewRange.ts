import type { RangePreset, RangeSpan, ResolvedRange, ViewLayout, ViewRange } from '../types/view';
import { fmtISO, startOfWeek, type WeekStart } from './date';

const PRESETS: readonly RangePreset[] = ['today', 'tomorrow', 'week', 'next7', 'upcoming', 'month'];
const SPANS: readonly RangeSpan[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'w1', 'w2', 'w3'];

/** The API serves at most this many days per request. */
const UPCOMING_DAYS = 42;

export function rangesFor(layout: ViewLayout): ViewRange[] {
  if (layout === 'list' || layout === 'table') return [...PRESETS];
  if (layout === 'columns') return [...SPANS];
  return [...SPANS, 'month'];
}

export function isRangeAvailable(layout: ViewLayout, range: ViewRange): boolean {
  return rangesFor(layout).includes(range);
}

const PRESET_TO_SPAN: Record<RangePreset, ViewRange> = {
  today: 'd1',
  tomorrow: 'd1',
  week: 'w1',
  next7: 'w1',
  upcoming: 'w3',
  month: 'month',
};

function spanToPreset(span: RangeSpan): RangePreset {
  if (span === 'd1') return 'today';
  if (span === 'w1') return 'week';
  if (span.startsWith('d')) return 'next7';
  return 'upcoming';
}

/** The closest range the layout accepts, so switching layout never lands on an invalid one. */
export function coerceRange(layout: ViewLayout, range: ViewRange): ViewRange {
  if (isRangeAvailable(layout, range)) return range;
  if (layout === 'list' || layout === 'table') return spanToPreset(range as RangeSpan);
  const span = PRESET_TO_SPAN[range as RangePreset] ?? 'w1';
  return isRangeAvailable(layout, span) ? span : 'w3';
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return fmtISO(d);
}

function spanLength(range: Exclude<ViewRange, 'month'>): number {
  switch (range) {
    case 'today':
    case 'tomorrow':
      return 1;
    case 'week':
    case 'next7':
      return 7;
    case 'upcoming':
      return UPCOMING_DAYS;
    default:
      return Number(range.slice(1)) * (range.startsWith('w') ? 7 : 1);
  }
}

function isWeekAligned(range: ViewRange): boolean {
  return range === 'week' || range.startsWith('w');
}

export function resolveRange(range: ViewRange, anchor: string, weekStart: WeekStart): ResolvedRange {
  if (range === 'month') {
    const d = parse(anchor);
    return {
      from: fmtISO(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: fmtISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      hideEmptyDays: false,
    };
  }
  const from = isWeekAligned(range)
    ? fmtISO(startOfWeek(parse(anchor), weekStart))
    : range === 'tomorrow' ? addDays(anchor, 1) : anchor;
  return { from, to: addDays(from, spanLength(range) - 1), hideEmptyDays: range === 'upcoming' };
}

/** The anchor one whole range earlier (-1) or later (+1). */
export function shiftAnchor(range: ViewRange, anchor: string, direction: 1 | -1): string {
  if (range === 'month') {
    const d = parse(anchor);
    return fmtISO(new Date(d.getFullYear(), d.getMonth() + direction, 1));
  }
  return addDays(anchor, spanLength(range) * direction);
}

/** The key pressed after `v` to pick this range, or null when it has none. */
export function rangeShortcut(range: ViewRange): string | null {
  if (range === 'today') return '1';
  if (range === 'week' || range === 'w1') return 'w';
  if (range === 'month') return 'm';
  if (/^d[1-6]$/.test(range)) return range.slice(1);
  return null;
}

export function rangeForShortcut(layout: ViewLayout, key: string): ViewRange | null {
  return rangesFor(layout).find((range) => rangeShortcut(range) === key) ?? null;
}
