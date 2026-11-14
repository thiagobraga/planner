import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPreferences } from '../api/client';
import { usePatchPreferences } from './usePatchPreferences';

/** Whether the page column spans the whole window, saved per user. */
export function useFullWidth() {
  const { data: prefs } = useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences });
  const patchPreferences = usePatchPreferences();
  const fullWidth = prefs?.fullWidth ?? false;
  const setFullWidth = useCallback((value: boolean) => {
    patchPreferences({ fullWidth: value }).catch((error: unknown) => console.error('Saving full width failed', error));
  }, [patchPreferences]);
  return { fullWidth, setFullWidth, toggleFullWidth: () => setFullWidth(!fullWidth) };
}
