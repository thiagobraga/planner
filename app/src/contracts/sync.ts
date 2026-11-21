// Shared wire contract. api/src/contracts and app/src/contracts must stay
// byte-identical (scripts/check-contracts.sh): types only, no imports.

export type SyncEntityType =
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

export type SyncEventType = 'created' | 'updated' | 'deleted' | 'completed' | 'uncompleted';

export interface SyncActor {
  type: 'token' | 'oauth';
  label: string;
}

export interface SyncEvent {
  id: string;
  entityType: SyncEntityType;
  eventType: SyncEventType;
  entityId: string;
  userId: string;
  collectionId?: string | null;
  payload?: unknown;
  /** Resolve membership at dispatch instead of relying on long-lived collection rooms. */
  audience?: 'current-collection-members';
  emittedAt: string;
  /** The socket whose request caused this event, so that tab can skip its own echo. */
  sourceId?: string;
  /** Present when an API token or OAuth app made the change. */
  actor?: SyncActor;
}
