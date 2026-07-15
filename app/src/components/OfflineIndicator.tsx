import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Global connectivity banner. Renders nothing while online; when offline it
 * shows a small, unobtrusive pill so the accent color is used per DESIGN.md
 * (state that needs the eye to stop) without dominating the screen.
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 py-2 px-3.5 text-[13px] leading-5 text-accent bg-accent/12 border border-accent rounded-md"
    >
      Offline — changes will sync when reconnected.
    </div>
  );
}
