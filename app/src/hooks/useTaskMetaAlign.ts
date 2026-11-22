import { useCallback } from 'react';
import { usePreferences } from './usePreferences';
import { usePatchPreferences } from './usePatchPreferences';

/** Whether task row metadata chips align to the right edge of each row, saved per user. */
export function useTaskMetaAlign() {
  const { data: prefs } = usePreferences();
  const patchPreferences = usePatchPreferences();
  const alignRight = prefs?.alignTaskItemsRight ?? false;
  const setAlignRight = useCallback((value: boolean) => {
    patchPreferences({ alignTaskItemsRight: value }).catch((error: unknown) =>
      console.error('Saving task item alignment failed', error),
    );
  }, [patchPreferences]);
  return { alignRight, setAlignRight };
}
