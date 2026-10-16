import { useEffect } from 'react';
import { getSocket } from '../utils/socket';
import { getQueuedMutationsForUser, removeMutation, remapQueuedId } from '../utils/offlineQueue';
import { request } from '../api/client';

export function useOfflineQueueReplay(userId: string | null): void {
  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();

    const replay = async () => {
      let mutations = await getQueuedMutationsForUser(userId);
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        try {
          const init: RequestInit = { method: mutation.method };
          if (mutation.body) {
            init.body = mutation.body;
          }
          const response = await request(mutation.path, init);
          await removeMutation(mutation.id);

          if (mutation.method === 'POST' && mutation.clientEntityId) {
            const serverId = (response as { id?: string } | undefined)?.id;
            if (serverId && serverId !== mutation.clientEntityId) {
              await remapQueuedId(mutation.clientEntityId, serverId);
              const refreshed = await getQueuedMutationsForUser(userId);
              const remainingIds = new Set(mutations.slice(i + 1).map((m) => m.id));
              mutations = [...mutations.slice(0, i + 1), ...refreshed.filter((m) => remainingIds.has(m.id))];
            }
          }
        } catch {
          break;
        }
      }
    };

    socket.on('connect', replay);

    return () => {
      socket.off('connect', replay);
    };
  }, [userId]);
}
