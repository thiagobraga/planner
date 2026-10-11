import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDaily } from '../api/client';

const INVALIDATE_DEBOUNCE_MS = 150;

/**
 * Every Daily view reads one range through this hook; only the range differs.
 * `refresh` invalidates every cached range once per burst, so a flurry of sync
 * events costs one request instead of one each.
 */
export function useDailyTasks(from: string, to: string) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const query = useQuery({
    queryKey: ['daily', from, to],
    queryFn: () => fetchDaily(from, to),
  });

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['daily'] });
    }, INVALIDATE_DEBOUNCE_MS);
  }, [qc]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { ...query, refresh };
}
