import { useEffect } from 'react';
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

export function useSync(handler: (event: SyncEvent) => void) {
  useEffect(() => {
    const socket = getSocket();
    socket.on('sync', handler);
    return () => {
      socket.off('sync', handler);
    };
  }, [handler]);
}
