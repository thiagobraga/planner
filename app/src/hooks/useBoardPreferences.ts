import { useCallback } from 'react';
import { usePatchPreferences } from './usePatchPreferences';
import type { BoardViewSettings, Preferences } from '../types/api';
import type { BoardGroupBy } from '../types/drag';
import type { BoardViewMode } from '../types/board';
import type { ViewLayout, ViewStyle } from '../types/view';

/** Layouts a collection (or Inbox) can show today. */
export const BOARD_LAYOUTS: readonly ViewLayout[] = ['list', 'columns', 'calendar'];

function presentation(layout: ViewLayout, style: ViewStyle): BoardViewMode {
  if (layout === 'columns') return style === 'cards' ? 'kanban' : 'kanban-list';
  return layout === 'calendar' ? 'calendar' : 'list';
}

/** Layout, style and grouping of one collection, saved per collection in preferences. */
export function useBoardPreferences(collectionId: string | undefined, preferences: Preferences | undefined) {
  const patchPreferences = usePatchPreferences();
  const mode = collectionId ? preferences?.boardViewModes?.[collectionId] : undefined;
  const layout: ViewLayout = mode?.layout && BOARD_LAYOUTS.includes(mode.layout) ? mode.layout : 'list';
  const style: ViewStyle = mode?.style ?? 'notebook';
  const groupBy: BoardGroupBy = mode?.groupBy === 'section' || mode?.groupBy === 'priority' ? mode.groupBy : 'status';

  const save = useCallback((change: BoardViewSettings) => {
    if (!collectionId || !preferences) return;
    const current = preferences.boardViewModes ?? {};
    patchPreferences(
      { boardViewModes: { [collectionId]: change } },
      { boardViewModes: { ...current, [collectionId]: { ...current[collectionId], ...change } } },
    ).catch((error: unknown) => console.error('Saving the board view failed', error));
  }, [collectionId, preferences, patchPreferences]);

  return {
    layout,
    style,
    groupBy,
    /** The presentation boards and lists already understand. */
    view: presentation(layout, style),
    /** A status board keeps its completion column filled even when completed tasks are hidden. */
    includeCompleted: Boolean(preferences?.hideCompletedTasks) && layout === 'columns' && groupBy === 'status',
    setLayout: (next: ViewLayout) => save({ layout: next }),
    setStyle: (next: ViewStyle) => save({ style: next }),
    toggleStyle: () => save({ style: style === 'notebook' ? 'cards' : 'notebook' }),
    setGroupBy: (next: BoardGroupBy) => save({ groupBy: next }),
  };
}
