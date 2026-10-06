import { Router } from "express";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { metadataHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/metadata.js";
import type { OAuthMetadata, OAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { MCP_RESOURCE_URL, PUBLIC_BASE_URL } from "../config.js";
import { API_TOKEN_SCOPES } from "../types/apiToken.js";
import { plannerOAuthProvider } from "./provider.js";

const OAUTH_BASE = `${PUBLIC_BASE_URL}/api/oauth`;
const MCP_PATH = new URL(MCP_RESOURCE_URL).pathname;

export const authorizationServerMetadata: OAuthMetadata = {
  issuer: PUBLIC_BASE_URL,
  authorization_endpoint: `${OAUTH_BASE}/authorize`,
  token_endpoint: `${OAUTH_BASE}/token`,
  registration_endpoint: `${OAUTH_BASE}/register`,
  revocation_endpoint: `${OAUTH_BASE}/revoke`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  revocation_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  scopes_supported: [...API_TOKEN_SCOPES],
};

export const protectedResourceMetadata: OAuthProtectedResourceMetadata = {
  resource: MCP_RESOURCE_URL,
  authorization_servers: [PUBLIC_BASE_URL],
  scopes_supported: [...API_TOKEN_SCOPES],
  bearer_methods_supported: ["header"],
  resource_name: "Planner",
};

export const PROTECTED_RESOURCE_METADATA_URL = `${PUBLIC_BASE_URL}/.well-known/oauth-protected-resource${MCP_PATH}`;

/**
 * OAuth 2.1 for hosted MCP clients, built from the SDK's endpoint handlers so
 * parameter, PKCE and client checks follow the spec. Endpoints live under
 * /api/oauth rather than the SDK's root paths: /register is the app's sign-up page.
 */
export function oauthRouter(): Router {
  const router = Router();
  router.use("/api/oauth/authorize", authorizationHandler({ provider: plannerOAuthProvider }));
  router.use("/api/oauth/token", tokenHandler({ provider: plannerOAuthProvider }));
  router.use(
    "/api/oauth/register",
    clientRegistrationHandler({ clientsStore: plannerOAuthProvider.clientsStore, clientSecretExpirySeconds: 0 }),
  );
  router.use("/api/oauth/revoke", revocationHandler({ provider: plannerOAuthProvider }));
  router.use("/.well-known/oauth-authorization-server", metadataHandler(authorizationServerMetadata));
  // RFC 9728 path-suffixed form first, plus the bare form older clients probe.
  router.use(`/.well-known/oauth-protected-resource${MCP_PATH}`, metadataHandler(protectedResourceMetadata));
  router.use("/.well-known/oauth-protected-resource", metadataHandler(protectedResourceMetadata));
  return router;
}
