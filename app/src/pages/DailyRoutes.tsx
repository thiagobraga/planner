import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { DailyPage } from './DailyPage';
import { DEFAULT_DAILY_SLUG, slugToView } from '../utils/dailyRange';
import type { DailySlug } from '../types/daily';

const LAST_VIEW_STORAGE_KEY = 'planner.daily.lastView.v1';

function loadLastSlug(): DailySlug {
  try {
    const stored = window.localStorage.getItem(LAST_VIEW_STORAGE_KEY) ?? undefined;
    return slugToView(stored) ? (stored as DailySlug) : DEFAULT_DAILY_SLUG;
  } catch {
    return DEFAULT_DAILY_SLUG;
  }
}

/** `/daily` has no view of its own; it sends the user to the one they used last. */
export function DailyIndexRedirect() {
  return <Navigate to={`/daily/${loadLastSlug()}`} replace />;
}

/** The URL decides the view. The last valid one is kept only for `/daily` to redirect to. */
export function DailyRoute() {
  const { view: slug } = useParams();
  const view = slugToView(slug);

  useEffect(() => {
    if (!view || !slug) return;
    try {
      window.localStorage.setItem(LAST_VIEW_STORAGE_KEY, slug);
    } catch {
      // only a convenience for the /daily redirect
    }
  }, [view, slug]);

  if (!view) return <Navigate to={`/daily/${DEFAULT_DAILY_SLUG}`} replace />;
  return <DailyPage view={view} />;
}
