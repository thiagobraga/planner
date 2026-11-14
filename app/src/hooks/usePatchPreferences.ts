import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUpdatePreferences } from '../api/client';
import type { Preferences } from '../types/api';

type PreferencesPatch = Partial<Omit<Preferences, 'userId'>>;

// Saves go out one at a time, so quick successive changes (a layout switch that also moves
// the range, then a range shortcut) reach the server in the order the user made them.
let inFlight: Promise<unknown> | null = null;
let latest = 0;

/**
 * Optimistically applies `local` to the cached preferences, sends `patch`, and rolls back on error.
 * `local` can differ from `patch` when the server merges (board view modes).
 */
export function usePatchPreferences() {
  const queryClient = useQueryClient();
  return useCallback((patch: PreferencesPatch, local: PreferencesPatch = patch) => {
    const previous = queryClient.getQueryData<Preferences>(['preferences']);
    if (previous) queryClient.setQueryData<Preferences>(['preferences'], { ...previous, ...local });
    const id = ++latest;
    const send = () => apiUpdatePreferences(patch);
    const request = inFlight ? inFlight.catch(() => undefined).then(send) : send();
    inFlight = request;
    const settle = () => {
      if (inFlight === request) inFlight = null;
    };
    request.then(settle, settle);
    return request
      .then((updated) => {
        // An older response would undo the optimistic state of a newer change still in flight.
        if (id === latest) queryClient.setQueryData(['preferences'], updated);
        return updated;
      })
      .catch((error: unknown) => {
        if (previous) queryClient.setQueryData(['preferences'], previous);
        queryClient.invalidateQueries({ queryKey: ['preferences'] });
        throw error;
      });
  }, [queryClient]);
}
