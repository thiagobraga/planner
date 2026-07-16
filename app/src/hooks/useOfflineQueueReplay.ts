import { useEffect } from 'react';
import { getSocket } from '../utils/socket';
import { getQueuedMutations, removeMutation, remapQueuedId } from '../utils/offlineQueue';
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
      let mutations = await getQueuedMutations();
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        try {
          const init: RequestInit = { method: mutation.method };
          if (mutation.body) {
            init.body = mutation.body;
          }
          const response = await request(mutation.path, init);
          await removeMutation(mutation.id);

          // A create-type mutation (POST with no id in its path) may have
          // resolved offline with a client-minted synthetic id, which the
          // app could have embedded into a dependent mutation queued right
          // after it (e.g. completing or deleting the same record while
          // still offline, queued as `/tasks/<clientId>/complete`). Now that
          // this create has actually replayed, remap any remaining queued
          // entries referencing the client id to the real server id before
          // continuing, so they target a record the server actually knows
          // about instead of 404ing and stalling the rest of the queue.
          if (mutation.method === 'POST' && mutation.clientEntityId) {
            const serverId = (response as { id?: string } | undefined)?.id;
            if (serverId && serverId !== mutation.clientEntityId) {
              await remapQueuedId(mutation.clientEntityId, serverId);
              const refreshed = await getQueuedMutations();
              const remainingIds = new Set(mutations.slice(i + 1).map((m) => m.id));
              mutations = [...mutations.slice(0, i + 1), ...refreshed.filter((m) => remainingIds.has(m.id))];
            }
          }
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
