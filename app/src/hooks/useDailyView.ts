import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Preferences } from '../types/api';
import type { DailyViewSettings, ViewLayout, ViewRange, ViewStyle } from '../types/view';
import { coerceRange, rangeForShortcut, resolveRange, shiftAnchor } from '../utils/viewRange';
import { usePatchPreferences } from './usePatchPreferences';

export const DEFAULT_DAILY_VIEW: DailyViewSettings = { style: 'notebook', range: 'week' };

/**
 * Daily's layout (from the URL), style and range (saved preferences) and the anchor day the
 * range starts from. The anchor follows today until the user navigates away.
 */
export function useDailyView(layout: ViewLayout, prefs: Preferences | undefined, todayKey: string) {
  const navigate = useNavigate();
  const patchPreferences = usePatchPreferences();
  const saved = prefs?.dailyView ?? DEFAULT_DAILY_VIEW;
  const style = saved.style;
  const range = coerceRange(layout, saved.range);
  const weekStart = prefs?.weekStart ?? 'sunday';
  const [pickedAnchor, setPickedAnchor] = useState<string | null>(null);
  const anchor = pickedAnchor ?? todayKey;
  const resolved = useMemo(() => resolveRange(range, anchor, weekStart), [range, anchor, weekStart]);

  const save = useCallback((next: DailyViewSettings) => {
    patchPreferences({ dailyView: next }).catch((error: unknown) => console.error('Saving the Daily view failed', error));
  }, [patchPreferences]);

  const setLayout = useCallback((next: ViewLayout) => {
    const nextRange = coerceRange(next, saved.range);
    if (nextRange !== saved.range) save({ style, range: nextRange });
    navigate(`/daily/${next}`);
  }, [navigate, save, saved.range, style]);

  const setStyle = useCallback((next: ViewStyle) => save({ style: next, range }), [save, range]);
  const setRange = useCallback((next: ViewRange) => save({ style, range: next }), [save, style]);
  const setRangeByShortcut = useCallback((key: string) => {
    const next = rangeForShortcut(layout, key);
    if (next) setRange(next);
  }, [layout, setRange]);

  return {
    layout,
    style,
    range,
    anchor,
    from: resolved.from,
    to: resolved.to,
    hideEmptyDays: resolved.hideEmptyDays,
    /** Today is inside the shown range. */
    includesToday: resolved.from <= todayKey && todayKey <= resolved.to,
    setLayout,
    setStyle,
    setRange,
    setRangeByShortcut,
    toggleStyle: () => setStyle(style === 'notebook' ? 'cards' : 'notebook'),
    previous: () => setPickedAnchor(shiftAnchor(range, anchor, -1)),
    next: () => setPickedAnchor(shiftAnchor(range, anchor, 1)),
    today: () => setPickedAnchor(null),
    pick: (iso: string) => setPickedAnchor(iso),
  };
}
