export interface SyncEvent {
  id: string;
  entityType:
    | 'task'
    | 'collection'
    | 'section'
    | 'status'
    | 'label'
    | 'comment'
    | 'reminder'
    | 'preferences'
    | 'habit'
    | 'habit_completion'
    | 'habit_group';
  eventType: 'created' | 'updated' | 'deleted' | 'completed' | 'uncompleted';
  entityId: string;
  userId: string;
  collectionId?: string | null;
  payload?: unknown;
  emittedAt: string;
  /** The socket whose request caused this event, when it named itself. */
  sourceId?: string;
  /** Present when an API token (an AI agent) made the change. */
  actor?: { type: 'token' | 'oauth'; label: string };
}
