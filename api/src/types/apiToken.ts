export type ApiTokenScope = "read" | "write";

export const API_TOKEN_SCOPES: readonly ApiTokenScope[] = ["read", "write"];

export const API_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;

export type ApiTokenExpiryDays = (typeof API_TOKEN_EXPIRY_DAYS)[number];

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
  /** null means the token never expires. */
  expiresInDays: ApiTokenExpiryDays | null;
}

export interface CreatedApiToken {
  token: ApiToken;
  /** Shown to the user exactly once; never stored. */
  rawToken: string;
}

export interface ApiTokenContext {
  userId: string;
  tokenId: string;
  name: string;
  scopes: ApiTokenScope[];
  lastUsedAt: Date | null;
}
