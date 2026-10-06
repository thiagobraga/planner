import type { ApiTokenScope } from "./apiToken.js";

export type ConsentDecision = "deny" | "read" | "write";

export interface AuthorizationRequestParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: ApiTokenScope[];
  state?: string;
  resource: string;
}

/** What the consent page shows; never includes the challenge or state. */
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

export interface OAuthAccessContext {
  userId: string;
  grantId: string;
  clientId: string;
  clientName: string;
  scopes: ApiTokenScope[];
  expiresAt: Date;
  lastUsedAt: Date | null;
}

export interface IssuedTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}
