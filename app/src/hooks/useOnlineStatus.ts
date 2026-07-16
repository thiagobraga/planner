import { useEffect, useState } from 'react';
import { getSocket, getSyncStatus } from '../utils/socket';

/**
 * Reports connectivity as the AND of two signals, since either one alone can
 * be misleading: `navigator.onLine` can stay true while only the API/socket
 * link is down, and the socket can be mid-reconnect while the wider network
 * is fine. Callers should treat `false` as "offline" for UI purposes.
 *
 * The socket signal only applies once `isAuthenticated` is true, because the
 * socket (see `AuthContext`) is only ever connected post-auth — pre-auth
 * (e.g. on the login screen) the socket is always disconnected regardless of
 * actual connectivity, so counting it there would make the app report
 * "offline" permanently before the user logs in.
 */
export function useOnlineStatus(isAuthenticated: boolean): boolean {
  const computeIsOnline = (authenticated: boolean) =>
    authenticated ? navigator.onLine && getSyncStatus() === 'connected' : navigator.onLine;

  const [isOnline, setIsOnline] = useState(() => computeIsOnline(isAuthenticated));

  useEffect(() => {
    const socket = getSocket();

    const update = () => {
      setIsOnline(computeIsOnline(isAuthenticated));
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    socket.on('connect', update);
    socket.on('disconnect', update);

    // Re-sync in case either signal changed between the initial render and
    // this effect committing (or `isAuthenticated` just changed).
    update();

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      socket.off('connect', update);
      socket.off('disconnect', update);
    };
  }, [isAuthenticated]);

  return isOnline;
}
