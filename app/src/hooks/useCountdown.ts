import { useState, useEffect } from 'react';

// Counts a rate-limit window down to zero. `start(seconds)` (re)arms it; the
// returned value is the seconds remaining, 0 when idle or elapsed.
export function useCountdown(): { secondsLeft: number; start: (seconds: number) => void } {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return { secondsLeft, start: setSecondsLeft };
}

export function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}
