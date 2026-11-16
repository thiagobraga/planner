export interface SocketData {
  userId: string;
  sessionId: number;
  rawToken?: string;
}

export type SyncEntityType = "task" | "collection" | "section" | "status" | "label" | "comment" | "reminder" | "preferences" | "habit" | "habit_completion" | "habit_group";
export type SyncEventType = "created" | "updated" | "deleted" | "completed" | "uncompleted";

export interface SyncEvent {
  id: string;
  entityType: SyncEntityType;
  eventType: SyncEventType;
  entityId: string;
  userId: string;
  collectionId?: string | null;
  payload?: unknown;
  emittedAt: string;
  /**
   * The socket whose request caused this event, when it named itself.
   *
   * A change is broadcast to every session of the user, the originating one
   * included. That session has already applied the change optimistically, so
   * acting on its own echo only costs it a refetch over state that is already
   * correct - it uses this to tell its own work apart from everyone else's.
   */
  sourceId?: string;
  /** Present when an API token made the change, so open tabs can say which agent did it. */
  actor?: { type: "token" | "oauth"; label: string };
}
