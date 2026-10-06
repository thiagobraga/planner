# Personal API Tokens - Tasks

## Context

- `api/src/middleware/auth.ts` reads only `req.cookies[buildCookieName()]` and calls `validateSession()`.
- `api/src/index.ts` chain for `/api/v1`: 415 JSON guard -> CORS -> `requestContext` -> `/auth` routes -> `originCheck` -> `authMiddleware` -> `csrfProtection` -> `routes`.
- `originCheck` already passes any `application/json` request, and the 415 guard forces JSON on writes, so bearer clients clear it without changes.
- `csrfProtection` must skip bearer-authenticated requests: CSRF defends ambient credentials (cookies); a bearer header is never attached by the browser on its own.
- `sessionService.ts` exports `generateRawToken()` (32 random bytes, base64url) and `hashToken()` (SHA-256 hex). Reuse both.
- `adminUserService.ts:180` / `:205` call `revokeAllUserSessions`; `authService.ts` `resetPassword` deletes sessions in a transaction.
- Next free migration number: `045`.

## 1. Database

- [x] 1.1 Write `api/src/db/migrations/045_api_tokens.sql` (use the `db-migration` skill)
  ```sql
  CREATE TABLE api_tokens (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    token_prefix  VARCHAR(16) NOT NULL,           -- "plnr_" + first 8 chars, for display only
    token_hash    VARCHAR(64) NOT NULL UNIQUE,    -- sha256 hex of the full raw token
    scopes        TEXT[] NOT NULL DEFAULT ARRAY['read'],
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    revoke_reason VARCHAR(100),
    CONSTRAINT api_tokens_scopes_valid CHECK (scopes <@ ARRAY['read','write']::TEXT[])
  );
  CREATE INDEX idx_api_tokens_user ON api_tokens(user_id) WHERE revoked_at IS NULL;
  ```
- [x] 1.2 Add `api_tokens` to the schema table list in `CLAUDE.md`.

## 2. Types

- [x] 2.1 `api/src/types/apiToken.ts`
  - `type ApiTokenScope = 'read' | 'write'`
  - `interface ApiToken { id; name; tokenPrefix; scopes: ApiTokenScope[]; createdAt; lastUsedAt: string | null; expiresAt: string | null }`
  - `interface CreateApiTokenInput { name: string; scopes: ApiTokenScope[]; expiresInDays: 30 | 90 | 365 | null }`
  - `interface ApiTokenContext { userId: string; tokenId: string; scopes: ApiTokenScope[]; lastUsedAt: Date | null }`
- [x] 2.2 `api/src/types/express.d.ts`: add `authMethod?: 'session' | 'token'`, `tokenId?: string`, `tokenScopes?: ApiTokenScope[]`.

## 3. Service - `api/src/services/apiTokenService.ts` (TDD, real DB)

- [x] 3.1 Tests first: `api/src/services/__tests__/apiTokenService.integration.test.ts`
  - create returns raw token starting with `plnr_`, row stores only the hash
  - list never returns `token_hash`, excludes revoked, ordered by `created_at DESC`
  - validate: ok / revoked -> null / expired -> null / unknown -> null / user `disabled_at` set -> null
  - revoke only affects the caller's own token (404 for someone else's id)
  - 21st active token -> `AppError TOKEN_LIMIT_REACHED` (409)
  - `revokeAllUserTokens(userId, reason)` revokes every active row
- [x] 3.2 `createApiToken(userId, input): Promise<{ token: ApiToken; rawToken: string }>`
  - `rawToken = 'plnr_' + generateRawToken()`; store `hashToken(rawToken)`, `token_prefix = rawToken.slice(0, 13)`
  - validate name (1-100 chars, trimmed), scopes non-empty subset; `write` implies `read` (store both)
  - enforce max 20 active tokens per user
  - `securityLog.apiTokenCreated(userId, tokenId)`
- [x] 3.3 `listApiTokens(userId): Promise<ApiToken[]>`
- [x] 3.4 `validateApiToken(rawToken): Promise<ApiTokenContext | null>`
  - reject unless it starts with `plnr_` (skip the DB hit)
  - `JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) AND u.disabled_at IS NULL`
- [x] 3.5 `touchApiToken(tokenId)` + `tokenNeedsTouch(ctx)` - bounded write, reuse the `needsTouch` idea with `SESSION_TOUCH_INTERVAL_SECONDS` so a busy agent does not write on every call
- [x] 3.6 `revokeApiToken(userId, tokenId)` and `revokeAllUserTokens(userId, reason)`
- [x] 3.7 Add `deleteExpiredApiTokens()` next to `deleteExpiredSessions()` and call it wherever session cleanup runs (keep revoked rows 30 days for audit, then delete)

## 4. Auth middleware (TDD)

- [x] 4.1 Tests in `api/src/middleware/__tests__/auth.test.ts`
  - cookie path unchanged
  - `Authorization: Bearer plnr_valid` -> `req.userId`, `req.authMethod = 'token'`, `req.tokenScopes`
  - invalid / revoked bearer -> 401 `UNAUTHORIZED`, with `WWW-Authenticate: Bearer` header
  - both cookie and bearer present -> cookie wins (browser), bearer ignored
  - non-`plnr_` bearer -> 401 (reserved for OAuth access tokens in `2026-10-05-mcp-oauth`)
- [x] 4.2 Implement in `api/src/middleware/auth.ts`: extract `parseBearer(req)`; if no session cookie and a bearer is present, call `validateApiToken`; set `req.authMethod`. Leave `req.sessionId` undefined for token requests.
- [x] 4.3 `api/src/middleware/csrf.ts`: `if (req.authMethod === 'token') return next();` with a one-line WHY comment. Test: bearer POST without `X-XSRF-TOKEN` succeeds; cookie POST without it still 403s.

## 5. Scope enforcement

- [x] 5.1 `api/src/middleware/requireScope.ts`: global middleware mounted after `authMiddleware`
  - token request + unsafe method + no `write` scope -> 403 `INSUFFICIENT_SCOPE`
  - session requests pass through untouched
- [x] 5.2 `requireSession` middleware (403 `SESSION_REQUIRED` when `authMethod === 'token'`) applied to:
  - `/api-tokens` routes
  - `/admin/*` (in `routes/index.ts`, before `adminAuthMiddleware`)
  - `/preferences` writes are allowed (agents may change view prefs); account mutations under `/auth` are already outside the token path since `/auth` skips `authMiddleware`
- [x] 5.3 Route tests in `api/src/routes/__tests__/security.test.ts`: read token POST -> 403; write token POST -> 201; token GET `/admin/users` -> 403; token GET `/api-tokens` -> 403.

## 6. Routes - `api/src/routes/apiTokens.ts`

- [x] 6.1 `GET /api-tokens` -> `ApiToken[]`
- [x] 6.2 `POST /api-tokens` -> `201 { token: ApiToken, rawToken }`
- [x] 6.3 `DELETE /api-tokens/:id` -> `200 { success: true }` (the app's `request()` helper always parses JSON, so 204 would throw)
- [x] 6.4 Mount in `routes/index.ts` with `requireSession`
- [x] 6.5 Route tests with supertest + real DB.

## 7. Revocation hooks

- [x] 7.1 `adminUserService.disableUser` and `revokeSessions` also call `revokeAllUserTokens(userId, same reason)`.
- [x] 7.2 `authService.resetPassword`: `UPDATE api_tokens SET revoked_at = NOW(), revoke_reason = 'password-reset' WHERE user_id = $1 AND revoked_at IS NULL` inside the existing transaction.
- [x] 7.3 Tests for each.

## 8. Socket.IO

- [x] 8.1 Confirmed `syncService` socket auth (`extractSessionFromSocket`) reads only the session cookie. No code change needed.

## 9. Frontend (TDD)

- [x] 9.1 `app/src/types/apiToken.ts` mirroring the API types.
- [x] 9.2 `app/src/api/client.ts`: `listApiTokens()`, `createApiToken(input)`, `revokeApiToken(id)`.
- [x] 9.3 `SettingsPage.tsx`: add `'integrations'` to `SettingsSection`, `isSettingsSection`, and `SETTINGS_SECTIONS` (lucide `KeyRound` icon); route `/settings/integrations`.
- [x] 9.4 `app/src/components/settings/ApiTokensSection.tsx`. Token endpoints are excluded from the offline mutation queue in `client.ts` (a queued create could never show the secret).
  - React Query `['api-tokens']`; list rows with prefix, scope, created, last used, expiry, Revoke
  - New-token form (name, access radio, expiry select), reveal-once panel with copy button
  - Revoke via `ConfirmModal`
  - Design system: Lora, cream, flat cards (1px border, no shadow), 24px rhythm, accent only on the primary action
- [x] 9.5 i18n keys in `en.ts` and `pt-BR.ts` (`settings.integrations.*`).
- [x] 9.6 Unit tests: renders list, creates and shows token once, hides it after close, revoke confirms.
- [x] 9.7 E2E `app/e2e/apiTokens.spec.ts`: create token in UI -> `request.get('/api/v1/views/today', { headers: { Authorization } })` returns 200 -> revoke in UI -> same request returns 401.
- [x] 9.8 Screenshots (desktop + narrow) in `app/dist/screenshots/`.

## 10. Docs

- [x] 10.1 Fix `CLAUDE.md` auth description (opaque cookie sessions + CSRF, not JWT Bearer) and add API tokens to Architecture, API Reference and Key Files.
- [x] 10.2 README: "Using the API from scripts" section with a curl example.

## Verification

- [x] `docker compose exec api npm run lint && docker compose exec api npm test`
- [x] `docker compose exec app npm run lint && docker compose exec app npm test`
- [x] `docker compose exec app npm run test:e2e`
- [x] Manual: token created in UI, task created with the bearer appears in Inbox (covered by `app/e2e/apiTokens.spec.ts`).
