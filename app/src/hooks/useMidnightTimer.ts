import { useEffect, useRef } from 'react';
import { getMsUntilMidnight } from '../utils/date';

export type MidnightCallback = () => void;

export function useMidnightTimer(onMidnight: MidnightCallback, timeZone?: string): void {
  const callbackRef = useRef(onMidnight);

  useEffect(() => {
    callbackRef.current = onMidnight;
  }, [onMidnight]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext() {
      const ms = getMsUntilMidnight(new Date(), timeZone);
      const delay = Math.max(ms, 100);
      timerId = setTimeout(() => {
        callbackRef.current();
        scheduleNext();
      }, delay);
    }

    scheduleNext();

    return () => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [timeZone]);
}
