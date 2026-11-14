import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUpdatePreferences } from '../api/client';
import type { Preferences } from '../types/api';

type PreferencesPatch = Partial<Omit<Preferences, 'userId'>>;

/**
 * Optimistically applies `local` to the cached preferences, sends `patch`, and rolls back on error.
 * `local` can differ from `patch` when the server merges (board view modes).
 */
export function usePatchPreferences() {
  const queryClient = useQueryClient();
  return useCallback((patch: PreferencesPatch, local: PreferencesPatch = patch) => {
    const previous = queryClient.getQueryData<Preferences>(['preferences']);
    if (previous) queryClient.setQueryData<Preferences>(['preferences'], { ...previous, ...local });
    return apiUpdatePreferences(patch)
      .then((updated) => {
        queryClient.setQueryData(['preferences'], updated);
        return updated;
      })
      .catch((error: unknown) => {
        if (previous) queryClient.setQueryData(['preferences'], previous);
        queryClient.invalidateQueries({ queryKey: ['preferences'] });
        throw error;
      });
  }, [queryClient]);
}
