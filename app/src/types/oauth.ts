import type { ApiTokenScope } from './apiToken';

export type ConsentDecision = 'deny' | 'read' | 'write';

export interface PendingAuthorization {
  id: string;
  clientName: string;
  clientUri: string | null;
  redirectHost: string;
  scopes: ApiTokenScope[];
}

export interface ConnectedApp {
  id: string;
  clientName: string;
  clientUri: string | null;
  scopes: ApiTokenScope[];
  createdAt: string;
  lastUsedAt: string | null;
}
