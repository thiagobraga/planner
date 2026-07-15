import { useEffect, useState } from 'react';
import { getSocket, getSyncStatus } from '../utils/socket';

/**
 * Reports connectivity as the AND of two signals, since either one alone can
 * be misleading: `navigator.onLine` can stay true while only the API/socket
 * link is down, and the socket can be mid-reconnect while the wider network
 * is fine. Callers should treat `false` as "offline" for UI purposes.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    () => navigator.onLine && getSyncStatus() === 'connected',
  );

  useEffect(() => {
    const socket = getSocket();

    const update = () => {
      setIsOnline(navigator.onLine && getSyncStatus() === 'connected');
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    socket.on('connect', update);
    socket.on('disconnect', update);

    // Re-sync in case either signal changed between the initial render and
    // this effect committing.
    update();

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      socket.off('connect', update);
      socket.off('disconnect', update);
    };
  }, []);

  return isOnline;
}
