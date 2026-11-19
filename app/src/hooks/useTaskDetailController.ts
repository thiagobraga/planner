import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useTaskDetailStore } from '../stores/taskDetailStore';
import { useMediaQuery, PHONE_QUERY } from './useMediaQuery';
import type { DetailLayout } from '../types/detail';

export const DETAIL_PARAM = 'task';
const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUSHED = 'detailPushed';

/**
 * The one detail controller: `?task=<id>` is the open item, so a reload or a
 * shared link reopens it and Back closes it. Opening from a closed panel
 * pushes a history entry, switching items replaces it, and closing pops it.
 */
export function useTaskDetailController(): string | null {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const raw = params.get(DETAIL_PARAM);
  const taskId = raw && TASK_ID.test(raw) ? raw : null;

  useLayoutEffect(() => {
    locationRef.current = location;
    useTaskDetailStore.setState({ taskId });
  }, [location, taskId]);

  useEffect(() => {
    const historyFlag = () => Boolean((locationRef.current.state as Record<string, unknown> | null)?.[PUSHED]);
    const target = (id: string | null) => {
      const search = new URLSearchParams(locationRef.current.search);
      if (id) search.set(DETAIL_PARAM, id);
      else search.delete(DETAIL_PARAM);
      const query = search.toString();
      return { pathname: locationRef.current.pathname, search: query ? `?${query}` : '' };
    };
    useTaskDetailStore.setState({
      navigator: {
        open: (id, replace) => navigate(target(id), replace ? { replace: true, state: { [PUSHED]: historyFlag() } } : { state: { [PUSHED]: true } }),
        close: () => {
          if (historyFlag()) navigate(-1);
          else navigate(target(null), { replace: true });
        },
      },
    });
    return () => useTaskDetailStore.setState({ navigator: null });
  }, [navigate]);

  return taskId;
}

/** Docked beside the page on wide screens, an overlay sheet when the page needs the room, a bottom sheet on phones. */
export function useDetailLayout(): DetailLayout {
  const phone = useMediaQuery(PHONE_QUERY);
  const wide = useMediaQuery('(min-width: 1024px)');
  const extraWide = useMediaQuery('(min-width: 1280px)');
  const { pathname } = useLocation();
  if (phone) return 'sheet';
  // The collections split view already spends 264px on its tree.
  if (pathname.startsWith('/collection')) return extraWide ? 'dock' : 'overlay';
  return wide ? 'dock' : 'overlay';
}
