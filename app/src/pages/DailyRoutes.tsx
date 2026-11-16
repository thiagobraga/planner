import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { DailyPage } from './DailyPage';
import { DEFAULT_DAILY_SLUG, legacyDailySlug, slugToLayout } from '../utils/dailyRange';
import type { LegacyDailyView } from '../types/daily';
import { DEFAULT_DAILY_VIEW } from '../hooks/useDailyView';
import { usePatchPreferences } from '../hooks/usePatchPreferences';
import type { Preferences } from '../types/api';
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
  const queryClient = useQueryClient();
  const patchPreferences = usePatchPreferences();
  const { layout, ...settings } = legacy;

  useEffect(() => {
    const current = queryClient.getQueryData<Preferences>(['preferences'])?.dailyView ?? DEFAULT_DAILY_VIEW;
    patchPreferences({ dailyView: { ...current, ...settings } }).catch(() => undefined);
    // Runs once per redirect; the settings come from a constant table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
