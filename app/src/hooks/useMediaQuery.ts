import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 640px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener?.('change', onChange);
      return () => mq?.removeEventListener?.('change', onChange);
    },
    () => window.matchMedia?.(query)?.matches ?? false,
    () => false,
  );
}
