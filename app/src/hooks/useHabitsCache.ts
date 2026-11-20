import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSync } from './useSync';
import { useCoalescedInvalidate } from './useCoalescedInvalidate';
import { isEchoedMove } from '../utils/moveEcho';
import type { ApiHabit, ApiHabitGroup } from '../types/api';

type HabitsData = { habits: ApiHabit[]; groups: ApiHabitGroup[] } | undefined;

/**
 * Writers for the ['habits'] cache plus its sync subscription. Remote habit,
 * completion and group changes refetch once per burst instead of once each.
 */
export function useHabitsCache() {
  const queryClient = useQueryClient();

  const setHabits = useCallback(
    (updater: (prev: ApiHabit[]) => ApiHabit[]) => {
      queryClient.setQueryData(['habits'], (prev: HabitsData) => ({ ...prev, habits: updater(prev?.habits ?? []) }));
    },
    [queryClient],
  );

  const setGroups = useCallback(
    (updater: (prev: ApiHabitGroup[]) => ApiHabitGroup[]) => {
      queryClient.setQueryData(['habits'], (prev: HabitsData) => ({ ...prev, groups: updater(prev?.groups ?? []) }));
    },
    [queryClient],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
  }, [queryClient]);

  const refreshSoon = useCoalescedInvalidate(['habits']);
  useSync(
    useCallback(
      (event) => {
        if (event.entityType !== 'habit' && event.entityType !== 'habit_completion' && event.entityType !== 'habit_group') return;
        // Our own habit or group move, still reconciling.
        if (isEchoedMove(event)) return;
        refreshSoon();
      },
      [refreshSoon],
    ),
  );

  return { setHabits, setGroups, invalidate };
}
