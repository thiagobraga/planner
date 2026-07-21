import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiUpdatePreferences,
  fetchPreferences,
  type Preferences,
} from '../api/client';

type VisibilityPreferenceKey = 'hideCompletedTasks' | 'hideOldNotes';

interface VisibilityPreferenceUpdate {
  key: VisibilityPreferenceKey;
  value: boolean;
}

export function useTaskVisibilityPreferences(onUpdated?: () => void) {
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  const mutation = useMutation({
    mutationFn: ({ key, value }: VisibilityPreferenceUpdate) =>
      key === 'hideCompletedTasks'
        ? apiUpdatePreferences({ hideCompletedTasks: value })
        : apiUpdatePreferences({ hideOldNotes: value }),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ['preferences'] });
      const previous = queryClient.getQueryData<Preferences>(['preferences']);
      if (previous) {
        queryClient.setQueryData<Preferences>(['preferences'], { ...previous, [key]: value });
      }
      return { previous };
    },
    onError: (_error, _update, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['preferences'], context.previous);
      }
    },
    onSuccess: (nextPreferences) => {
      queryClient.setQueryData(['preferences'], nextPreferences);
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      onUpdated?.();
    },
  });

  return {
    preferences,
    isPending: mutation.isPending,
    setHideCompletedTasks: (value: boolean) =>
      mutation.mutate({ key: 'hideCompletedTasks', value }),
    setHideOldNotes: (value: boolean) =>
      mutation.mutate({ key: 'hideOldNotes', value }),
  };
}
