# Push-based app version check

## Context

`useVersionCheck.ts` currently polls `GET /api/v1/version` every 5 min per open tab (plus opportunistic focus/online checks), which shows up as a steady stream of `/api/v1/version` requests in the network panel for any tab left open for hours - harmless but wasteful, and it's the trigger for this change. The app already has an authenticated Socket.IO connection open for every logged-in tab (real-time task sync), so the fix is to have the server *push* a version announcement over that existing socket instead of clients repeatedly asking. Only the authenticated `AppShell` uses this hook today (confirmed via repo-wide grep - `AppShell.tsx:27` is the sole call site), so there's no logged-out/anonymous-socket case to solve for.

Trigger for the announcement: **auto-on-boot** (user-confirmed). Each API instance publishes its own version to Redis once, right after Socket.IO attaches at process start - no deploy-script changes. Tradeoff accepted: on a rolling deploy, the moment the first replacement instance boots, it tells every already-connected client everywhere, even before the rest of the fleet has rotated (a bit earlier/more eager than today's "converges once everyone's rotated" polling behavior, but strictly faster and simpler).

## Backend changes

### `api/src/services/syncService.ts`
- Add `const VERSION_CHANNEL = "version";` next to `SYNC_CHANNEL`.
- Import `LATEST_VERSION` from `../utils/buildInfo.js`.
- Add a standalone publish helper (a version announcement has no `userId`/`entityType`, so it doesn't fit `SyncEvent` - don't shoehorn it into `publishEvent`):
  ```ts
  export async function publishVersionAnnouncement(version: string): Promise<void> {
    await redisPubClient.publish(VERSION_CHANNEL, JSON.stringify({ version }));
  }
  ```
- In `attachSyncServer`'s `io.on("connection", ...)`, after the room joins, add `socket.emit("version", { version: LATEST_VERSION });` - covers every fresh/reconnected socket (background tab returning, network blip) for free, since `socket.ts` already re-establishes the connection on focus/online/pageshow.
- After the existing `redisSubClient.subscribe(SYNC_CHANNEL, ...)` block, add a second subscription on `VERSION_CHANNEL` that parses `{ version }` and does `io.emit("version", { version })` - a deliberate global broadcast (first one in this file; everything else is room-scoped to `user:*`/`collection:*`), worth a one-line comment noting that.
- No change to `SyncEvent`/`SyncEntityType`/existing `sync` channel handling.

### `api/src/index.ts`
- Import `publishVersionAnnouncement` from `./services/syncService.js`.
- In `start()`, right after `await attachSyncServer(httpServer);` (same `try` block, so a Redis outage disables it the same way it disables sync): `await publishVersionAnnouncement(LATEST_VERSION);`
- `GET /api/v1/version` (lines 114-116) stays as-is - remains the one-shot baseline source for the frontend's first fetch.

### `api/src/db/redis.ts`, `api/src/utils/buildInfo.ts`
No changes. Second `.subscribe` on `redisSubClient` for a different channel is already an established node-redis v4 pattern; `LATEST_VERSION`'s existing env-override-or-`BUILD_VERSION` semantics are reused as-is.

## Frontend changes

### `app/src/hooks/useVersionCheck.ts`
Keep: module-scope singleton state (`initialVersion`, `updateAvailable`, `subscribers` Set), "stop once found, only reload clears it" behavior, public `useVersionCheck(): boolean` contract.

Delete: `POLL_INTERVAL_MS`, `MIN_POLL_GAP_MS`, `intervalId`, `inFlight`, `lastPollAt`, `pollIfStale`, `onWake`, `onVisibilityChange`, the `online`/`visibilitychange` listeners, `setInterval` - all superseded by the socket's own reconnect handling plus the server's per-connection push.

New shape (`startPolling`/`stopPolling` → `startListening`/`stopListening`):
- `fetchInitialVersion()`: one-shot REST call (guarded by a `started` boolean, not interval/`inFlight`), seeds `initialVersion` from `current`, immediately checks `latest !== initialVersion` (covers "update already happened before this tab connected").
- `checkLatest(latest: string)`: shared comparison logic; on mismatch sets `updateAvailable = true`, calls `stopListening()`, notifies subscribers.
- `onVersionPush(payload: { version: string })`: calls `checkLatest(payload.version)`, registered via `getSocket().on('version', onVersionPush)`.
- `startListening()` / `stopListening()`: subscribe/unsubscribe to the socket's `'version'` event, mirroring the existing subscriber-count-gated start/stop structure.

No changes needed to `AppShell.tsx` or `UpdateToast.tsx` (both only consume the boolean prop).

## Tests (TDD - red, then green, per file)

1. **`api/src/services/__tests__/syncService.server.test.ts`**: extend the Redis mock to key subscribe callbacks by channel (currently assumes one global callback) and add `emit: vi.fn()` to `mockIO`. New cases: subscribes to both `sync` and `version` channels; `connection` emits `version` with `LATEST_VERSION`; a `version`-channel message triggers `mockIO.emit('version', ...)` (global, not room-scoped); malformed JSON is dropped; `publishVersionAnnouncement` publishes correctly.
2. **`app/src/hooks/__tests__/useVersionCheck.test.ts`**: full rewrite, mock `../../utils/socket` like `useSync.test.ts` does. Drop all fake-timer/online/hidden setup. Cases: no update when push matches baseline; update when push differs; socket push still works if REST call fails; REST baseline itself already mismatched → immediate update; singleton behavior across concurrent mounts; listener `off()`'d once update found; unmount/remount toggles `on`/`off`.
3. **`UpdateToast.test.tsx`**, **`TaskItem.test.tsx`**: confirmed unaffected (decoupled prop consumer; unrelated grep hit on "conversion") - no changes, just a pass-through sanity check.

## Verification

- `docker compose exec api npm test` and `docker compose exec app npm test` - full suite green.
- Manual: two browser tabs on `docker compose`, restart the `api` container, confirm both tabs' update toast appears without any reload and without waiting 5 minutes; open a third fresh tab afterward and confirm it also shows the banner immediately on connect (per-connection emit path).
- Network panel: confirm no more recurring `/api/v1/version` polling for a long-lived tab - just one request on load.
