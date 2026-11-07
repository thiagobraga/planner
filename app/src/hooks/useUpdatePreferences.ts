import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiUpdatePreferences } from '../api/client';
import type { Preferences } from '../types/api';

export function useUpdatePreferences() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<Omit<Preferences, 'userId'>>) => apiUpdatePreferences(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['preferences'] });
      const previous = qc.getQueryData<Preferences>(['preferences']);
      if (previous) {
        qc.setQueryData<Preferences>(['preferences'], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        qc.setQueryData(['preferences'], context.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData<Preferences>(['preferences'], (prev) => (prev ? { ...prev, ...data } : data));
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}
