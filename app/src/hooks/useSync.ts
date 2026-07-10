import { useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';

export interface SyncEvent {
  id: string;
  entityType: 'task' | 'project' | 'section' | 'label' | 'comment' | 'reminder';
  eventType: 'created' | 'updated' | 'deleted' | 'completed' | 'uncompleted';
  entityId: string;
  userId: string;
  projectId?: string | null;
  payload?: unknown;
  emittedAt: string;
}

const MAX_SEEN = 50;

export function useSync(handler: (event: SyncEvent) => void) {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    const seen = seenRef.current;

    const wrapped = (event: SyncEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      if (seen.size > MAX_SEEN) {
        const first = seen.values().next().value;
        if (first) seen.delete(first);
      }
      handler(event);
    };

    socket.on('sync', wrapped);
    return () => {
      socket.off('sync', wrapped);
    };
  }, [handler]);
}
