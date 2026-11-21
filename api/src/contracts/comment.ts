// Shared wire contract. api/src/contracts and app/src/contracts must stay
// byte-identical (scripts/check-contracts.sh): types only, no imports.

export interface TaskCommentDto {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
  /** Label of the API token or OAuth app that wrote it; null for browser sessions. */
  actorLabel: string | null;
}

/**
 * Payload of a `comment` sync event. Carries only the task id: the body stays
 * off the broadcast and clients refetch it through the authorized REST route.
 */
export interface CommentSyncPayload {
  taskId: string;
}
