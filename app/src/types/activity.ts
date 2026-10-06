export type ActorType = 'session' | 'token' | 'oauth';

export interface ActivityEntry {
  id: string;
  userId: string;
  collectionId: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  createdAt: string;
  title: string | null;
  actor: { type: ActorType; tokenId: string | null; label: string | null };
}

export interface ActivityPage {
  events: ActivityEntry[];
  nextCursor: string | null;
}

export interface ActivityQuery {
  tokenId?: string;
  source?: 'token';
  cursor?: string;
}
