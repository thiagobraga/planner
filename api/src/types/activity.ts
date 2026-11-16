export type ActorType = "session" | "token" | "oauth";

export interface ActivityRow {
  id: string;
  user_id: string;
  collection_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  before_data: unknown | null;
  after_data: unknown | null;
  created_at: string;
  actor_type: ActorType;
  api_token_id: string | null;
  oauth_grant_id: string | null;
  actor_label: string | null;
  title: string | null;
}

export interface SearchableEntity {
  id: string;
  type: "task" | "collection" | "label";
  text: string;
  updatedAt: string;
  description?: string | null;
}

export interface SearchResults {
  tasks: SearchableEntity[];
  collections: SearchableEntity[];
  labels: SearchableEntity[];
}

export interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}

export interface ReminderRow {
  id: string;
  task_id: string;
  user_id: string;
  remind_at: string;
  is_fired: boolean;
  created_at: string;
}

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
