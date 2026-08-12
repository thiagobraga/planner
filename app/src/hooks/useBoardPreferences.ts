import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiUpdatePreferences,
  type BoardGroupBy,
  type BoardViewMode,
  type Preferences,
} from '../api/client';

export function useBoardPreferences(collectionId: string | undefined, preferences: Preferences | undefined) {
  const queryClient = useQueryClient();
  const mode = collectionId ? preferences?.boardViewModes?.[collectionId] : undefined;
  const view = mode?.view ?? 'list';
  const groupBy = mode?.groupBy ?? 'status';

  const persist = useCallback((patch: { view?: BoardViewMode; groupBy?: BoardGroupBy }) => {
    if (!collectionId || !preferences) return;
    const previous = preferences;
    const currentModes = preferences.boardViewModes ?? {};
    const boardViewModes = {
      ...currentModes,
      [collectionId]: { ...currentModes[collectionId], ...patch },
    };
    queryClient.setQueryData<Preferences>(['preferences'], { ...preferences, boardViewModes });
    apiUpdatePreferences({ boardViewModes })
      .then((updated) => queryClient.setQueryData(['preferences'], updated))
      .catch(() => {
        queryClient.setQueryData(['preferences'], previous);
        queryClient.invalidateQueries({ queryKey: ['preferences'] });
      });
  }, [collectionId, preferences, queryClient]);

  return {
    view,
    groupBy,
    setView: useCallback((next: BoardViewMode) => persist({ view: next }), [persist]),
    setGroupBy: useCallback((next: BoardGroupBy) => persist({ groupBy: next }), [persist]),
  };
}
