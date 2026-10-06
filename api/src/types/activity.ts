export type ActorType = "session" | "token" | "oauth";

/** The non-browser caller behind a request, when there is one. */
export interface RequestActor {
  type: Exclude<ActorType, "session">;
  /** The API token id, or the OAuth grant id. */
  credentialId: string;
  label: string;
}

export interface ActivityRecord {
  id?: string;
  userId: string;
  collectionId: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  beforeData?: unknown;
  afterData?: unknown;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  collectionId: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: string;
  /** Best available title: snapshot at the time, else the live task's. */
  title: string | null;
  actor: { type: ActorType; tokenId: string | null; grantId: string | null; label: string | null };
}

export interface ListActivityOptions {
  /** ISO timestamp; return events strictly before this. */
  cursor?: string;
  collectionId?: string;
  tokenId?: string;
  /** "token": only the caller's own non-browser activity. */
  source?: "token";
}
