import { useQuery } from '@tanstack/react-query';
import { fetchPreferences } from '../api/client';

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });
}
