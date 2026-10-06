import { useEffect } from 'react';

const VISIBLE_MS = 6000;

/** Short-lived notice that an AI agent changed something; replaced by the next one. */
export function AgentNotice({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:px-0">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto max-w-[360px] rounded-md border border-border px-3 py-2 text-[13px] leading-6 text-ink shadow-overlay"
        style={{ backgroundColor: 'var(--planner-overlay-bg)' }}
      >
        {message}
      </div>
    </div>
  );
}
