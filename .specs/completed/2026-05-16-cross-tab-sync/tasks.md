# Cross-Tab Real-Time Sync

Tasks created, updated, or deleted in one browser tab appear in all other open tabs within 2 seconds.

## Root cause

`mergeTodayFromApi()` in TodayPage is additive - never removes tasks. Deletions from other tabs persist in local state. InboxPage is fine (react-query invalidation handles all event types).

## Additional findings from Inbox regression

The visible failure is in Inbox: a task created in one tab does not appear in another tab. The current frontend invalidates React Query for all task sync events in `AppShell`, so Inbox should refetch if a `"sync"` socket event is received. That makes the likely failure earlier in the chain: Socket.IO connection/routing, backend sync startup, or event publication.

Current deployment config explicitly routes only `/api` to the API service in Traefik. `/socket.io` reaches the app service and relies on Vite's dev proxy to forward to the API. That is fragile and can fail outside the dev-server path. Backend startup also swallows Redis/sync startup failures and continues without real-time sync, which can make the app look healthy while sync is disabled.

## Tasks

- [x] Backend publishes sync events after create/update/complete/reopen/delete
- [x] AuthContext connects socket on auth, disconnects on logout
- [x] `hooks/useSync.ts` subscribes to `"sync"` socket events
- [x] InboxPage invalidates react-query on task events
- [x] TodayPage: replace merge logic with full replace on re-fetch
- [x] TodayPage: handle `deleted` event by removing entityId directly (no re-fetch)
- [x] Add explicit Traefik routing for `PathPrefix('/socket.io')` to the API service with websocket support, instead of relying on the app/Vite proxy.
- [x] Add frontend Socket.IO diagnostics in development: log `connect`, `disconnect`, `connect_error`, and received `sync` events behind a debug flag.
- [x] Add backend sync diagnostics: log successful Socket.IO attach, authenticated socket connection user id, Redis subscription readiness, and publish failures.
- [x] Stop silently disabling sync on Redis/Socket.IO startup failure; expose sync health clearly in logs (`⚠️ SYNC DISABLED`).
- [x] Handle `publishEvent(...)` failures in task mutations with `.catch()` logging instead of `void`.
- [x] Add an integration/manual test checklist for two browser tabs on `/inbox`: create, edit, complete, delete, and verify the second tab updates within 2 seconds.
- [x] Add an automated test around `AppShell`/`useSync` proving a task `sync` event invalidates the `['inbox']` query and triggers a visible refetch.
- [x] Verified: `AppShell` and `TodayPage` both call `useSync` intentionally - AppShell handles react-query invalidation, TodayPage handles local state. No duplication issue.
- [x] Add a browser-visible sync status during development - green/red dot + "sync" label, bottom-right corner, dev-only.
- [x] BroadcastChannel fallback: decided no. App requires server connectivity anyway; added complexity not worth it for this project.

## Expected flow

```
Tab 1: create task
  → apiCreateTask → backend INSERT
  → publishEvent(created, payload=task) → Redis → io.to(userRoom)
  → Tab 2 socket: useSync fires → re-fetch → new task appears ✅

Tab 1: delete task
  → apiDeleteTask → backend DELETE
  → publishEvent(deleted, entityId) → Redis → io.to(userRoom)
  → Tab 2 socket: useSync → eventType==='deleted' → remove entityId from sections ✅
```

## Files

- `app/src/pages/TodayPage.tsx` - fix merge → replace; handle deleted event type
