import { useEffect, useRef } from 'react';
import { getSocket, getSocketId } from '../utils/socket';

export interface SyncEvent {
  id: string;
  entityType: 'task' | 'collection' | 'section' | 'label' | 'comment' | 'reminder' | 'preferences' | 'habit' | 'habit_completion' | 'habit_group';
  eventType: 'created' | 'updated' | 'deleted' | 'completed' | 'uncompleted';
  entityId: string;
  userId: string;
  collectionId?: string | null;
  payload?: unknown;
  emittedAt: string;
  /** The socket whose request caused this event, when it named itself. */
  sourceId?: string;
}

const MAX_SEEN = 50;

export function useSync(handler: (event: SyncEvent) => void) {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    const seen = seenRef.current;

    const wrapped = (event: SyncEvent) => {
      // This session's own change, already applied optimistically and reconciled
      // from the response it is waiting on. Acting on the echo would refetch
      // over state that is already correct, and make the row it just placed
      // jump as the answer arrives.
      if (event.sourceId && event.sourceId === getSocketId()) return;
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
