# MCP OAuth Sign-in - Plan

Part 4 of 4 in the "AI agents talk to Planner" roadmap. Depends on `2026-10-05-mcp-server`; builds on `2026-10-05-api-tokens` and `2026-10-05-agent-activity-attribution`.

## Why

Personal API tokens work well for Claude Code, Claude Desktop, Cursor and scripts, where I can paste a header into a config file. Hosted clients (claude.ai web and mobile custom connectors, ChatGPT connectors, and similar) do not let me paste a header. They expect the MCP server to support the **MCP authorization flow** (OAuth 2.1): I add the server URL, a Planner login and consent screen pops up, and the client receives its own revocable credential.

With this I can ask about my tasks from the Claude mobile app without ever copying a token.

## What the user sees

### Connecting a hosted client

1. In claude.ai (Settings > Connectors > Add custom connector) I paste `https://<my-planner-host>/api/v1/mcp`.
2. A browser window opens on Planner. If I am not logged in, I see the normal login page first (email/password or Google).
3. A **consent screen** in Planner's paper style:

   > **Claude** wants to access your Planner
   > - Read your tasks, collections, labels and habits
   > - Create, edit, complete and delete tasks; log habits
   >
   > [ Read only ]  [ Allow read & write ]  [ Cancel ]

   The client name and its website (domain) are shown so I can tell a real client from an impostor.
4. I approve, the window closes, and the client lists Planner's tools.

### Managing connected apps

**Settings > Integrations** gets a **Connected apps** list (above API tokens):

- App name, domain, access level, connected date, last used
- **Disconnect** revokes everything the app holds; its next call fails and it has to ask again
- Changes the app makes show *via &lt;App name&gt;* in agent activity, same as tokens

### Security behaviors

- Only the MCP endpoint accepts OAuth access tokens; the rest of the REST API does not (keeps the blast radius small).
- Access tokens are short-lived (1 hour); clients refresh silently with a rotating refresh token (30-day idle expiry).
- Using an old refresh token twice revokes the whole grant (theft detection).
- Disabling a user, an admin "revoke sessions", or a password reset disconnects every app.
- Only HTTPS redirect URIs (plus `http://localhost` / `127.0.0.1` for desktop clients) are accepted.

## Out of scope

- Acting as an OAuth provider for anything other than the MCP endpoint ("Sign in with Planner").
- Per-collection consent.
- Admin-managed allow-lists of clients (add later if Planner becomes multi-tenant).

## Relevant Files

**API**
- `api/src/db/migrations/048_oauth.sql` (new)
- `api/src/oauth/metadata.ts` (new) - `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`
- `api/src/oauth/clients.ts` (new) - client registration / client metadata documents
- `api/src/oauth/authorize.ts` (new) - authorization code + PKCE
- `api/src/oauth/token.ts` (new) - code exchange, refresh rotation, revocation
- `api/src/services/oauthService.ts` (new)
- `api/src/types/oauth.ts` (new)
- `api/src/middleware/auth.ts` (accept OAuth access tokens on `/mcp` only)
- `api/src/routes/mcp.ts` (`WWW-Authenticate` with `resource_metadata` on 401)
- `api/src/index.ts` (mount `/.well-known/*` and `/oauth/*` outside the `/api/v1` CSRF/origin chain)
- `api/src/services/adminUserService.ts`, `api/src/services/authService.ts` (revoke grants)
- `api/src/config.ts` (`PUBLIC_BASE_URL`)
- `compose.yml`, `compose.prod.yml` (route `/.well-known` and `/oauth` to the API)

**App**
- `app/src/pages/OAuthConsentPage.tsx` (new), route `/oauth/consent`
- `app/src/App.tsx`
- `app/src/components/settings/ConnectedAppsSection.tsx` (new)
- `app/src/api/client.ts`
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
- `app/e2e/mcpOAuth.spec.ts` (new)

**Docs**
- `CLAUDE.md`, `README.md`, `.env.example`
