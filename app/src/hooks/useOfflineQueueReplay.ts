import { useEffect } from 'react';
import { getSocket } from '../utils/socket';
import { getQueuedMutations, removeMutation } from '../utils/offlineQueue';
import { request } from '../api/client';

/**
 * Replays queued offline mutations, in FIFO order, each time the sync socket
 * (re)connects. The socket's `connect` event is used rather than the
 * browser's `online` event because a reachable socket is the real signal
 * that the API is reachable - `navigator.onLine` can be true while the
 * server/socket link is still down.
 *
 * Stops at the first failure and leaves the remaining queue (including the
 * failed entry) untouched, so ordering is preserved for the next reconnect
 * attempt. No retry/backoff here by design - see task brief.
 *
 * `enabled` gates the subscription (pass `isAuthenticated`) rather than the
 * hook being called conditionally, since hooks must run unconditionally -
 * the socket is only ever connected post-auth anyway, so there is nothing to
 * replay against before that.
 */
export function useOfflineQueueReplay(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();

    const replay = async () => {
      const mutations = await getQueuedMutations();
      for (const mutation of mutations) {
        try {
          const init: RequestInit = { method: mutation.method };
          if (mutation.body) {
            init.body = mutation.body;
          }
          await request(mutation.path, init);
          await removeMutation(mutation.id);
        } catch {
          // Stop on first failure; leave this and later mutations queued.
          break;
        }
      }
    };

    socket.on('connect', replay);

    return () => {
      socket.off('connect', replay);
    };
  }, [enabled]);
}
