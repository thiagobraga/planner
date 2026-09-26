import { useCallback, useSyncExternalStore } from 'react';
import type { BackgroundPreference, ResolvedTheme } from '../types/theme';
import { DARK_SCHEME_QUERY, resolveTheme } from '../utils/theme';

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

/** Resolves the background preference, tracking OS scheme changes only while it is `system`. */
export function useResolvedTheme(preference: BackgroundPreference): ResolvedTheme {
  const followsSystem = preference === 'system';
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!followsSystem) return () => {};
      const mq = window.matchMedia(DARK_SCHEME_QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [followsSystem],
  );
  const prefersDark = useSyncExternalStore(subscribe, systemPrefersDark);

  return resolveTheme(preference, prefersDark);
}
