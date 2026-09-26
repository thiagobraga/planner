import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiUpdatePreferences,
  type BoardGroupBy,
  type Preferences,
} from '../api/client';
import type { BoardViewMode } from '../types/board';

const BOARD_VIEW_STORAGE_KEY = 'planner.boardViews.v1';

function loadView(collectionId: string | undefined): BoardViewMode {
  if (!collectionId) return 'list';
  try {
    const stored = JSON.parse(window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    const view = stored[collectionId];
    return view === 'kanban' || view === 'kanban-list' ? view : 'list';
  } catch {
    return 'list';
  }
}

function saveView(collectionId: string, view: BoardViewMode): void {
  try {
    const stored = JSON.parse(window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, JSON.stringify({ ...stored, [collectionId]: view }));
  } catch {
    // Local view state is optional when browser storage is unavailable.
  }
}

export function useBoardPreferences(collectionId: string | undefined, preferences: Preferences | undefined) {
  const queryClient = useQueryClient();
  const mode = collectionId ? preferences?.boardViewModes?.[collectionId] : undefined;
  const [localView, setLocalView] = useState(() => ({ collectionId, view: loadView(collectionId) }));
  const view = localView.collectionId === collectionId ? localView.view : loadView(collectionId);
  const groupBy = mode?.groupBy ?? 'status';

  const persistGroupBy = useCallback((groupBy: BoardGroupBy) => {
    if (!collectionId || !preferences) return;
    const previous = preferences;
    const currentModes = preferences.boardViewModes ?? {};
    const boardViewModes = {
      ...currentModes,
      [collectionId]: { groupBy },
    };
    queryClient.setQueryData<Preferences>(['preferences'], { ...preferences, boardViewModes });
    apiUpdatePreferences({ boardViewModes })
      .then((updated) => queryClient.setQueryData(['preferences'], updated))
      .catch(() => {
        queryClient.setQueryData(['preferences'], previous);
        queryClient.invalidateQueries({ queryKey: ['preferences'] });
      });
  }, [collectionId, preferences, queryClient]);

  const setView = useCallback((next: BoardViewMode) => {
    if (!collectionId) return;
    setLocalView({ collectionId, view: next });
    saveView(collectionId, next);
  }, [collectionId]);

  return { view, groupBy, setView, setGroupBy: persistGroupBy };
}
