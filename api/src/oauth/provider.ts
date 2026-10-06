import type { Response } from "express";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  InvalidClientMetadataError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { MCP_RESOURCE_URL, PUBLIC_BASE_URL } from "../config.js";
import { API_TOKEN_SCOPES, type ApiTokenScope } from "../types/apiToken.js";
import {
  challengeForCode,
  createAuthorizationRequest,
  exchangeCode,
  exchangeRefresh,
  findClient,
  revokeByToken,
  saveClient,
  validateOAuthAccessToken,
} from "../services/oauthService.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** HTTPS everywhere, except plain HTTP back to the user's own machine (desktop clients). */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
  } catch {
    return false;
  }
}

const clientsStore: OAuthRegisteredClientsStore = {
  getClient: (clientId) => findClient(clientId),
  registerClient: async (client) => {
    if (!client.redirect_uris.every((uri) => isAllowedRedirectUri(String(uri)))) {
      throw new InvalidClientMetadataError("redirect_uris must use https (or http on localhost)");
    }
    return saveClient(client as OAuthClientInformationFull);
  },
};

function requestedScopes(scopes: string[] | undefined): ApiTokenScope[] {
  // A client that asks for nothing is offered everything; the user can still pick read-only.
  if (!scopes || scopes.length === 0) return ["read", "write"];
  if (!scopes.every((scope) => API_TOKEN_SCOPES.includes(scope as ApiTokenScope))) {
    throw new InvalidScopeError(`Supported scopes: ${API_TOKEN_SCOPES.join(" ")}`);
  }
  return scopes.includes("write") ? ["read", "write"] : ["read"];
}

function checkResource(resource: URL | undefined): void {
  if (resource && resource.href !== MCP_RESOURCE_URL) {
    throw new InvalidTargetError(`This server only issues tokens for ${MCP_RESOURCE_URL}`);
  }
}

export const plannerOAuthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    checkResource(params.resource);
    const id = await createAuthorizationRequest({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: requestedScopes(params.scopes),
      state: params.state,
      resource: MCP_RESOURCE_URL,
    });
    // The app's consent page signs the user in if needed, then settles the request.
    res.redirect(302, `${PUBLIC_BASE_URL}/oauth/consent?request=${id}`);
  },

  challengeForAuthorizationCode: (client, code) => challengeForCode(client.client_id, code),

  exchangeAuthorizationCode: (client, code, _verifier, redirectUri, resource) => {
    checkResource(resource);
    return exchangeCode(client.client_id, code, redirectUri, resource?.href);
  },

  exchangeRefreshToken: (client, refreshToken, scopes, resource) => {
    checkResource(resource);
    return exchangeRefresh(client.client_id, refreshToken, scopes, resource?.href);
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const ctx = await validateOAuthAccessToken(token);
    if (!ctx) throw new InvalidTokenError("Invalid or expired access token");
    return {
      token,
      clientId: ctx.clientId,
      scopes: ctx.scopes,
      expiresAt: Math.floor(ctx.expiresAt.getTime() / 1000),
      resource: new URL(MCP_RESOURCE_URL),
    };
  },

  revokeToken: (client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) =>
    revokeByToken(client.client_id, request.token),
};
