export type ApiTokenScope = 'read' | 'write';

export type ApiTokenExpiryDays = 30 | 90 | 365 | null;

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface CreateApiTokenInput {
  name: string;
  scopes: ApiTokenScope[];
  expiresInDays: ApiTokenExpiryDays;
}

export interface CreatedApiToken {
  token: ApiToken;
  rawToken: string;
}
