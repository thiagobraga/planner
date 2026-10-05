# MCP OAuth Sign-in - Tasks

## Context

- Planner is both the **authorization server** and the **resource server** (the MCP endpoint). No third-party IdP; login reuses the existing cookie session (email/password or Google).
- The MCP authorization spec builds on OAuth 2.1 with: PKCE `S256` (mandatory), RFC 8414 authorization server metadata, RFC 9728 protected resource metadata, RFC 8707 resource indicators, and client registration via Client ID Metadata Documents and/or RFC 7591 Dynamic Client Registration. **Before starting, re-read the current MCP authorization spec revision** (modelcontextprotocol.io, "Authorization") and the `@modelcontextprotocol/sdk` auth helpers; adjust this task list if the required pieces changed.
- The SDK ships server-side auth helpers (`mcpAuthRouter`, `requireBearerAuth`, an `OAuthServerProvider` interface). Prefer implementing `OAuthServerProvider` on top of `oauthService.ts` and mounting the SDK router over hand-writing every endpoint, if it fits Express 4 and our error shape. Decide in task 0 and record the decision here.
- Next migration number after the other roadmap specs: `048`.

## 0. Spike

- [ ] 0.1 Read the current MCP auth spec + SDK auth module; list the exact endpoints and headers the current Claude and ChatGPT connectors need.
- [ ] 0.2 Decide: SDK `mcpAuthRouter` + custom provider vs hand-rolled routes. Record the result below.
- [ ] 0.3 Decide registration support: Client ID Metadata Documents (fetch `client_id` URL, validate `redirect_uris`) and/or Dynamic Client Registration. Support whichever the target clients use today; both if cheap.

## 1. Database - `api/src/db/migrations/048_oauth.sql`

- [ ] 1.1 Tables (all secrets stored as SHA-256 hashes):
  ```sql
  CREATE TABLE oauth_clients (
    id             VARCHAR(255) PRIMARY KEY,        -- generated id (DCR) or metadata URL (CIMD)
    name           VARCHAR(200) NOT NULL,
    uri            VARCHAR(500),
    logo_uri       VARCHAR(500),
    redirect_uris  TEXT[] NOT NULL,
    registration   VARCHAR(10) NOT NULL CHECK (registration IN ('dcr', 'cimd')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata_fetched_at TIMESTAMPTZ
  );
  CREATE TABLE oauth_grants (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id     VARCHAR(255) NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scopes        TEXT[] NOT NULL,
    resource      VARCHAR(500) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    revoke_reason VARCHAR(100)
  );
  CREATE TABLE oauth_codes (
    code_hash      VARCHAR(64) PRIMARY KEY,
    grant_id       UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
    redirect_uri   VARCHAR(500) NOT NULL,
    code_challenge VARCHAR(128) NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL,          -- 60 seconds
    used_at        TIMESTAMPTZ
  );
  CREATE TABLE oauth_tokens (
    token_hash    VARCHAR(64) PRIMARY KEY,
    grant_id      UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
    kind          VARCHAR(10) NOT NULL CHECK (kind IN ('access', 'refresh')),
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ                     -- refresh rotation / reuse detection
  );
  CREATE INDEX idx_oauth_grants_user ON oauth_grants(user_id) WHERE revoked_at IS NULL;
  CREATE INDEX idx_oauth_tokens_grant ON oauth_tokens(grant_id);
  ```
- [ ] 1.2 `activity_events.actor_type` already allows `'oauth'` (from attribution spec); add `oauth_grant_id UUID REFERENCES oauth_grants(id) ON DELETE SET NULL` in this migration.

## 2. Config and routing

- [ ] 2.1 `config.ts`: `PUBLIC_BASE_URL` (issuer and resource URL base; required in production, derived from `CORS_ORIGIN` in dev). Add to `.env.example`.
- [ ] 2.2 `index.ts`: mount `/.well-known/*` and `/oauth/*` **before** the `/api/v1` chain (they must not hit `originCheck`, the JSON-only 415 guard, or CSRF: `/oauth/token` receives `application/x-www-form-urlencoded`). Apply `express.urlencoded` only on `/oauth/token` and `/oauth/revoke`, plus a dedicated rate limiter.
- [ ] 2.3 `compose.yml` / `compose.prod.yml`: add Traefik routers for `PathPrefix(/.well-known/oauth)` and `PathPrefix(/oauth/)` (API endpoints) while `/oauth/consent` stays on the app. Mirror in `app/vite.config.ts` proxy.

## 3. Metadata

- [ ] 3.1 `GET /.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/v1/mcp` -> `{ resource: PUBLIC_BASE_URL + '/api/v1/mcp', authorization_servers: [PUBLIC_BASE_URL], scopes_supported: ['read', 'write'], bearer_methods_supported: ['header'] }`
- [ ] 3.2 `GET /.well-known/oauth-authorization-server` -> issuer, `authorization_endpoint`, `token_endpoint`, `registration_endpoint` (if DCR), `revocation_endpoint`, `response_types_supported: ['code']`, `grant_types_supported: ['authorization_code', 'refresh_token']`, `code_challenge_methods_supported: ['S256']`, `token_endpoint_auth_methods_supported: ['none']`, `client_id_metadata_document_supported` (if CIMD).
- [ ] 3.3 `routes/mcp.ts`: on 401 send `WWW-Authenticate: Bearer resource_metadata="<PUBLIC_BASE_URL>/.well-known/oauth-protected-resource/api/v1/mcp"`; on insufficient scope send `error="insufficient_scope", scope="write"`.

## 4. Client registration - `api/src/oauth/clients.ts`

- [ ] 4.1 DCR `POST /oauth/register`: validate `redirect_uris` (https, or http on `localhost`/`127.0.0.1`), `client_name` required, public clients only (`token_endpoint_auth_method: none`). Rate-limit per IP.
- [ ] 4.2 CIMD: when `client_id` is an https URL, fetch it (timeout 5s, max 64kb, no redirects to private IP ranges: SSRF guard), validate `client_id` matches the URL and `redirect_uris`, cache in `oauth_clients` for 24h.
- [ ] 4.3 Tests: bad redirect schemes, SSRF targets (`127.0.0.1`, `169.254.169.254`, `10.x`), oversized documents, mismatch.

## 5. Authorize - `api/src/oauth/authorize.ts`

- [ ] 5.1 `GET /oauth/authorize`: validate `client_id`, exact `redirect_uri` match, `response_type=code`, `code_challenge` + `code_challenge_method=S256`, `resource` equals our MCP resource, `scope` subset of `read write`, `state` passthrough. Errors before redirect URI is validated render an error page; after, redirect with `error=`.
- [ ] 5.2 If no session cookie -> redirect to `/login?next=<authorize URL>` (check `LoginPage` honors `next`; add it if not, allowing only same-origin relative paths).
- [ ] 5.3 With a session -> redirect to app `/oauth/consent?request=<signed, short-lived request id>` (store pending request in Redis, 10 min TTL).
- [ ] 5.4 `POST /api/v1/oauth/consent` (cookie session + CSRF, normal chain): `{ requestId, decision: 'deny' | 'read' | 'write' }` -> create/update `oauth_grants`, issue code (hash stored, 60s expiry), respond with the redirect URL; the page navigates there.

## 6. Token - `api/src/oauth/token.ts`

- [ ] 6.1 `authorization_code`: verify code unused + unexpired, `redirect_uri` match, PKCE (`BASE64URL(SHA256(code_verifier)) === code_challenge`), `resource` match; mark used; issue access (`plnr_oat_` prefix, 1h) and refresh (`plnr_ort_` prefix, 30 days) tokens. Code reuse -> revoke the grant.
- [ ] 6.2 `refresh_token`: rotate (mark old `used_at`, issue a new pair); presenting an already-used refresh token revokes the grant (`revoke_reason = 'refresh-reuse'`).
- [ ] 6.3 `POST /oauth/revoke` (RFC 7009).
- [ ] 6.4 Tests for every branch, including timing-safe comparisons and expired codes.

## 7. Resource server

- [ ] 7.1 `auth.ts`: bearer starting with `plnr_oat_` -> `validateOAuthAccessToken` (grant not revoked, user not disabled, token unexpired, `resource` matches) -> `req.authMethod = 'oauth'`, `req.tokenScopes`, `setActor({ type: 'oauth', grantId, label: clientName })`.
- [ ] 7.2 OAuth tokens are only accepted on `/api/v1/mcp`; elsewhere -> 403 `TOKEN_NOT_ALLOWED`. Test both.
- [ ] 7.3 `routes/mcp.ts` accepts `authMethod` `token` or `oauth`.
- [ ] 7.4 Throttled `last_used_at` touch on the grant.

## 8. Revocation hooks

- [ ] 8.1 `adminUserService` disable / revoke sessions and `authService.resetPassword` revoke all `oauth_grants` for the user.
- [ ] 8.2 Expired code/token cleanup alongside session cleanup.

## 9. Frontend

- [ ] 9.1 `OAuthConsentPage.tsx` (inside `AuthShell` style, outside `AppShell`): client name, domain from `redirect_uri`, logo only if served over https, permission list per scope, three buttons. Design system: Lora, cream, accent only on the primary action.
- [ ] 9.2 Route `/oauth/consent` in `App.tsx` requiring auth (redirect to login with `next`).
- [ ] 9.3 `ConnectedAppsSection.tsx` in Settings > Integrations: `GET /api/v1/oauth/grants`, `DELETE /api/v1/oauth/grants/:id` (session-only, like token management).
- [ ] 9.4 i18n (en, pt-BR); unit tests; screenshots desktop + narrow.

## 10. Tests end to end

- [ ] 10.1 API integration: full flow with a fake public client (register -> authorize with session cookie -> consent -> code -> token -> `tools/list` on `/mcp` -> refresh -> revoke -> 401).
- [ ] 10.2 Playwright `app/e2e/mcpOAuth.spec.ts`: drive authorize -> login -> consent in the browser, capture the redirect, exchange the code with `request`, call MCP.
- [ ] 10.3 Manual: add the dev server as a custom connector in claude.ai (needs a publicly reachable HTTPS URL, e.g. a tunnel) and ask "what's on my plate today?".

## 11. Docs

- [ ] 11.1 `CLAUDE.md`: OAuth tables in Database, `/oauth/*` and `/.well-known/*` in API reference, auth methods summary (session / token / oauth and where each is accepted).
- [ ] 11.2 README: "Connect from claude.ai or ChatGPT".
- [ ] 11.3 Security review (`/security-review`) before merge.

## Verification

- [ ] API + app lint and tests, E2E green
- [ ] `npx @modelcontextprotocol/inspector` completes the OAuth flow against the dev stack
