import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

const INVALIDATE_DEBOUNCE_MS = 150;

/**
 * Invalidate `queryKey` once per burst of sync events: an agent batch or an
 * import sends many events back to back, and each would otherwise refetch.
 */
export function useCoalescedInvalidate(queryKey: QueryKey): () => void {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keyRef = useRef(queryKey);
  useEffect(() => {
    keyRef.current = queryKey;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void qc.invalidateQueries({ queryKey: keyRef.current }), INVALIDATE_DEBOUNCE_MS);
  }, [qc]);
}
