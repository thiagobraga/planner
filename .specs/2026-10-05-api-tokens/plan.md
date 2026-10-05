# Personal API Tokens - Plan

Part 1 of 4 in the "AI agents talk to Planner" roadmap:

1. **Personal API tokens** (this spec) - the credential every agent integration uses
2. `2026-10-05-mcp-server` - MCP endpoint exposing Planner as agent tools
3. `2026-10-05-agent-activity-attribution` - show which agent changed what
4. `2026-10-05-mcp-oauth` - OAuth 2.1 so claude.ai / ChatGPT connectors can sign in

## Why

Today the only way to authenticate against the API is the browser session cookie (`planner_session`) plus a CSRF double-submit token on every write. That works for the web app, but a script or an AI agent would need my email and password, would have to log in, keep a cookie jar, and echo the CSRF cookie back as a header. That is fragile and means handing my password to a third-party tool.

I want to create a **personal API token** in Settings, paste it into an agent (Claude Code, Claude Desktop, Cursor, a cron script), and have it act on my behalf - and be able to revoke it at any time without touching my password or my browser sessions.

## What the user sees

### Settings > Integrations

A new **Integrations** tab in Settings (next to General and Appearance) with an **API tokens** section:

- A list of my tokens: name, scope (Read only / Read & write), prefix (`plnr_a1b2...`), created date, last used ("3 minutes ago" / "Never"), expiry ("Never" or a date), and a **Revoke** button.
- A **New token** button opens a small form:
  - **Name** (required, e.g. "Claude Desktop on laptop")
  - **Access**: Read only, or Read & write
  - **Expires**: 30 days, 90 days, 1 year, Never (default 90 days)
- After creating, the full token is shown **once** in a copyable field with a clear note: "Copy it now - you won't be able to see it again." Closing the dialog hides it forever.
- Revoking asks for confirmation, then the token stops working immediately (the next request returns 401).

### Using a token

```
curl -H "Authorization: Bearer plnr_xxxxxxxx" https://planner.example.com/api/v1/views/today
```

- Every existing `/api/v1/*` endpoint accepts the token, with the same permissions I have in the web app.
- A **Read only** token can call `GET` endpoints; any write returns `403 INSUFFICIENT_SCOPE`.
- Changes made with a token sync to my open browser tabs in real time, exactly like changes made in the UI.
- No CSRF header, no cookies, no login step.

### What tokens cannot do

- Manage tokens (create / list / revoke) - only a browser session can, so a leaked token cannot mint more tokens or hide itself.
- Change password, email, or log in / out.
- Reach `/admin/*`, even for an admin user.
- Open a Socket.IO connection (agents do not need live push; sockets stay cookie-only).

### Security behaviors

- Tokens are stored hashed (SHA-256); the raw value only exists in the creation response.
- Tokens have a recognizable prefix (`plnr_`) so secret scanners (GitHub push protection, etc.) can be configured to catch leaks.
- Disabling a user (admin), an admin "revoke sessions" action, or a password reset revokes all their tokens, same as sessions.
- A disabled account's tokens are rejected even if somehow still unrevoked.
- Each user can hold at most 20 active tokens.

## Out of scope

- OAuth / third-party app authorization (see `2026-10-05-mcp-oauth`).
- Fine-grained per-collection scopes. Two scopes (`read`, `write`) cover the agent use case; more can be added later without a migration since scopes are stored as an array.
- Token usage analytics beyond `last_used_at`.

## Relevant Files

**API**
- `api/src/db/migrations/045_api_tokens.sql` (new)
- `api/src/services/apiTokenService.ts` (new)
- `api/src/types/apiToken.ts` (new)
- `api/src/routes/apiTokens.ts` (new)
- `api/src/routes/index.ts`
- `api/src/middleware/auth.ts`
- `api/src/middleware/csrf.ts`
- `api/src/middleware/requireScope.ts` (new)
- `api/src/types/express.d.ts`
- `api/src/services/sessionService.ts` (reuse `generateRawToken`, `hashToken`)
- `api/src/services/adminUserService.ts` (revoke tokens on disable)
- `api/src/services/authService.ts` (`resetPassword` revokes tokens)
- `api/src/routes/adminUsers.ts`, `api/src/routes/auth.ts` (block token auth)
- `api/src/utils/securityLogger.ts`
- Tests under `api/src/services/__tests__/`, `api/src/middleware/__tests__/`, `api/src/routes/__tests__/`

**App**
- `app/src/pages/SettingsPage.tsx` (new `integrations` section)
- `app/src/components/settings/ApiTokensSection.tsx` (new)
- `app/src/api/client.ts` (token endpoints)
- `app/src/types/apiToken.ts` (new)
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
- `app/e2e/apiTokens.spec.ts` (new)

**Docs**
- `CLAUDE.md` (auth section is stale: says JWT Bearer, actual is opaque cookie sessions; document tokens)
- `README.md`
