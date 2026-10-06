# Agent Activity Attribution - Plan

Part 3 of 4 in the "AI agents talk to Planner" roadmap. Depends on `2026-10-05-api-tokens`; most useful together with `2026-10-05-mcp-server`.

## Why

Once an agent can create, move, reschedule and delete my tasks, I need to be able to see **what it did**. If a task disappears or moves to a strange date, I want to know whether it was me, a collaborator, or "Claude Desktop on laptop" acting with my token.

The API already records `activity_events` and serves them at `GET /api/v1/activity`, but the app has no screen that shows them, and events do not record *how* a change was made.

## What the user sees

### Token activity in Settings

In **Settings > Integrations**, each token row gains a **View activity** button. It opens a panel listing everything done with that token, newest first:

> **Created** "Call the dentist" · Personal · 2 min ago
> **Completed** "Buy milk" · Inbox · 1 h ago
> **Deleted** "Old draft" · Work · yesterday

- Loads 50 at a time with a "Load more" button.
- Deleted tasks still show their title (taken from the activity record), not a broken link.
- Entries for tasks that still exist open the task detail when clicked.

### Recent agent activity

At the top of the Integrations tab, a **Recent agent activity** list shows the last 20 changes made by *any* token, each with a *via &lt;token name&gt;* tag. This is the "what did my agents do today?" view.

- If a token is later revoked or renamed, old entries keep the name it had at the time.
- Changes made in the web app never appear here.

### Live notice (optional, off by default)

When a change made by a token arrives while Planner is open, a small, non-blocking toast says "Claude Desktop on laptop completed 'Buy milk'". Toggle in Settings > General: "Notify me when integrations change my tasks".

## Out of scope

- A general, all-sources activity feed page (this spec only covers token-originated activity).
- Batch undo of agent actions (separate spec on top of undo/redo history).
- Attribution for collaborators (already covered by `user_id` on activity events).

## Relevant Files

**API**
- `api/src/db/migrations/046_activity_actor.sql` (new)
- `api/src/middleware/requestContext.ts` (carry the actor in the AsyncLocalStorage store)
- `api/src/middleware/auth.ts` (set the actor after token validation)
- `api/src/services/taskService.ts`, `api/src/services/completionSync.ts` (the 6 `INSERT INTO activity_events` sites)
- `api/src/services/activityService.ts` (return actor, filter by token / any token)
- `api/src/routes/activity.ts` (`?token_id=` and `?source=token` filters)
- `api/src/services/syncService.ts` (`SyncEvent.actor`)
- `api/src/types/activity.ts` (new)

**App**
- `app/src/types/activity.ts` (new), sync event type
- `app/src/api/client.ts` (`listActivity`)
- `app/src/components/settings/TokenActivityList.tsx` (new)
- `app/src/components/settings/ApiTokensSection.tsx`
- `app/src/hooks/useSync.ts` (optional toast)
- `app/src/pages/SettingsPage.tsx` (preference toggle)
- `api/src/db/migrations/047_preferences_agent_notices.sql` (new preference column)
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
