# Agent Activity Attribution - Tasks

## Context

- `activity_events` columns: `id, user_id, collection_id, entity_type, entity_id, event_type, before_data, after_data, created_at` (migrations 015, 024).
- Insert sites (6): `taskService.ts` (~152, ~218, ~772, ~1738) and `completionSync.ts` (~57, ~72). Grep `INSERT INTO activity_events` before starting; the count may have grown.
- `requestContext.ts` already stores `{ sourceId }` in AsyncLocalStorage for every `/api/v1` request and exposes `currentSourceId()`. Extend the same store instead of threading a parameter through services.
- `requestContext` runs **before** `authMiddleware`, so the store must be mutable (set the actor after auth succeeds).
- Migration numbers: `046` (actor), `047` (preference). Renumber if other specs land first.

## 1. Database

- [x] 1.1 `api/src/db/migrations/046_activity_actor.sql`
  ```sql
  ALTER TABLE activity_events
    ADD COLUMN actor_type VARCHAR(20) NOT NULL DEFAULT 'session',
    ADD COLUMN api_token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
    ADD COLUMN actor_label VARCHAR(100);
  ALTER TABLE activity_events
    ADD CONSTRAINT activity_events_actor_type_valid CHECK (actor_type IN ('session', 'token', 'oauth'));
  CREATE INDEX idx_activity_token ON activity_events(api_token_id, created_at DESC) WHERE api_token_id IS NOT NULL;
  CREATE INDEX idx_activity_user_actor ON activity_events(user_id, created_at DESC) WHERE actor_type <> 'session';
  ```
  `actor_label` snapshots the token name so renames/revokes do not rewrite history. `'oauth'` is reserved for `2026-10-05-mcp-oauth`.

## 2. Request context

- [x] 2.1 `requestContext.ts`: add `actor?: { type: 'token' | 'oauth'; tokenId: string; label: string }` to `RequestContext`; export `setActor(actor)` (mutates the current store) and `currentActor()`.
- [x] 2.2 `auth.ts`: after a successful `validateApiToken`, call `setActor({ type: 'token', tokenId, label: tokenName })`. `validateApiToken` must also return `name`.
- [x] 2.3 Unit test: actor set inside a request is visible to code awaited later in the same request, and not leaked to a concurrent request.

## 3. Writes

- [x] 3.1 (changed) `recordActivity(db, record)` in `activityService.ts` is the single writer; it reads `currentActor()` itself, so call sites cannot forget the actor.
- [x] 3.2 Update all 6 insert sites to include the three columns. Keep SQL explicit (no dynamic column building).
- [x] 3.3 Integration tests (real DB): a task created via bearer token stores `actor_type='token'`, the token id and name; via cookie session stores `'session'` and nulls.
- [x] 3.4 Gap found: task creates and edits were never logged, which would have hidden most agent work. Added `task_created` and `task_updated` (with the changed field names). Still not logged: drag moves (`moveTask`), habits, collections, labels.

## 4. Sync event

- [x] 4.1 `syncService.ts`: add optional `actor?: { type; label }` to `SyncEvent`, filled from `currentActor()` in `buildEvent`. Never include the token id in the broadcast.
- [x] 4.2 Update `CLAUDE.md` SyncEvent shape.

## 5. Read API

- [x] 5.1 `api/src/types/activity.ts`: `ActivityEntry` (move the inline shape out of `activityService.ts`) plus `actor: { type; tokenId: string | null; label: string | null }`.
- [x] 5.2 `listActivity(userId, { cursor, collectionId, tokenId, source })`:
  - `tokenId`: verify the token belongs to `userId` (404 otherwise), filter `api_token_id = $n`
  - `source: 'token'`: filter `actor_type <> 'session' AND user_id = $1` (only my own agents, not collaborators')
- [x] 5.3 Display title: `COALESCE(after_data->>'title', before_data->>'title', t.title)` with a LEFT JOIN on tasks; new create/update events snapshot the title.
- [x] 5.4 `routes/activity.ts`: accept `token_id` (uuid) and `source=token`; validate at the boundary.
- [x] 5.5 Route tests: filters, ownership, pagination cursor.

## 6. Frontend

- [x] 6.1 `app/src/types/activity.ts`; `client.ts#listActivity(params)`.
- [x] 6.2 `TokenActivityList.tsx`: infinite list via `useInfiniteQuery(['activity', params])`, rows "Verb 'title' · time", `via <label>` on the cross-token list. Not done: collection name per row and click-to-open task detail.
- [x] 6.3 `ApiTokensSection.tsx`: "Recent agent activity" (source=token, 20 items) below the token list; an "Activity" button per token expands that token's list inline.
- [x] 6.4 Handled in `AppShell`'s sync handler with a small `AgentNotice` component (`UpdateToast` is version-specific, nothing generic to reuse) and `utils/agentNotice.ts` for the message.
- [x] 6.5 Invalidate `['activity']` and `['api-tokens']` (for last-used) on any sync event with an `actor`.
- [x] 6.6 i18n (en, pt-BR): verbs per `event_type`, "via {{label}}", empty states.
- [x] 6.7 Unit tests for the list and the toast gating; screenshots desktop + narrow.

## 7. Preference

- [x] 7.1 `api/src/db/migrations/047_preferences_agent_notices.sql`: `ALTER TABLE preferences ADD COLUMN agent_change_notices BOOLEAN NOT NULL DEFAULT FALSE;`
- [x] 7.2 Wired through `preferencesService.ts` and the app `Preferences` type; the toggle lives in Settings > Integrations, next to the tokens it is about.

## 8. E2E

- [x] 8.1 `app/e2e/agentActivity.spec.ts`: create token, `POST /api/v1/tasks` with it, open Settings > Integrations, assert the entry with "via <name>" is listed; enable the preference, create another task via token, assert toast.

## Verification

- [x] API + app lint and tests, E2E green
- [x] Manual with the MCP server: ask the agent to complete a task, see it in Recent agent activity
