import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { DailyPage } from './DailyPage';
import { DEFAULT_DAILY_SLUG, legacyDailySlug, slugToLayout } from '../utils/dailyRange';
import type { LegacyDailyView } from '../types/daily';
import { DEFAULT_DAILY_VIEW } from '../hooks/useDailyView';
import { usePatchPreferences } from '../hooks/usePatchPreferences';
import { usePreferences } from '../hooks/usePreferences';
import type { ViewLayout } from '../types/view';

const LAST_LAYOUT_STORAGE_KEY = 'planner.daily.lastLayout.v2';

function loadLastLayout(): ViewLayout {
  try {
    return slugToLayout(window.localStorage.getItem(LAST_LAYOUT_STORAGE_KEY) ?? undefined) ?? DEFAULT_DAILY_SLUG;
  } catch {
    return DEFAULT_DAILY_SLUG;
  }
}

/** `/daily` has no layout of its own; it sends the user to the one they used last on this device. */
export function DailyIndexRedirect() {
  return <Navigate to={`/daily/${loadLastLayout()}`} replace />;
}

/** Old `/daily/kanban|cards|monthly` links keep opening what they used to show. */
function LegacyDailyRedirect({ legacy }: { legacy: LegacyDailyView }) {
  const { data: prefs, isError } = usePreferences();
  const patchPreferences = usePatchPreferences();
  const { layout, ...settings } = legacy;
  const loaded = prefs !== undefined;

  // Waits for the saved view: merging into the default on a fresh load would drop the
  // saved style, and only a loaded cache gets the optimistic update the page renders from.
  useEffect(() => {
    if (!prefs) return;
    patchPreferences({ dailyView: { ...(prefs.dailyView ?? DEFAULT_DAILY_VIEW), ...settings } }).catch(() => undefined);
    // Runs once, when preferences first arrive; the settings come from a constant table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded && !isError) return null;
  return <Navigate to={`/daily/${layout}`} replace />;
}

/** The URL decides the layout. The last valid one is kept only for `/daily` to redirect to. */
export function DailyRoute() {
  const { view: slug } = useParams();
  const layout = slugToLayout(slug);

  useEffect(() => {
    if (!layout) return;
    try {
      window.localStorage.setItem(LAST_LAYOUT_STORAGE_KEY, layout);
    } catch {
      // only a convenience for the /daily redirect
    }
  }, [layout]);

  const legacy = legacyDailySlug(slug);
  if (legacy) return <LegacyDailyRedirect legacy={legacy} />;
  if (!layout) return <Navigate to={`/daily/${DEFAULT_DAILY_SLUG}`} replace />;
  return <DailyPage layout={layout} />;
}
