import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../contexts/AuthContext';

/**
 * Global connectivity banner. Renders nothing while online; when offline it
 * shows a small, unobtrusive pill so the accent color is used per DESIGN.md
 * (state that needs the eye to stop) without dominating the screen.
 *
 * Must be rendered inside `AuthProvider` (it reads `useAuth()`), but should
 * still render unconditionally on both the login screen and the
 * authenticated app shell.
 */
export function OfflineIndicator() {
  const { isAuthenticated } = useAuth();
  const isOnline = useOnlineStatus(isAuthenticated);

  if (isOnline) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[110] flex justify-center px-4 py-6 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:justify-end sm:px-0 sm:py-0 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 py-2 px-3.5 text-[13px] leading-5 text-accent bg-accent/12 border border-accent rounded-md"
      >
        Offline. Changes sync automatically when you're back online.
      </div>
    </div>
  );
}
