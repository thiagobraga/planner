# Sync resilience: sticky offline banner + duplicated version polling

## Symptoms

1. "Offline. Changes sync automatically when you're back online." stays on screen
   indefinitely while the network is fine (REST requests return 200 in the same tab).
2. The Network tab fills with repeated `GET /api/v1/version` requests.

## Root cause

### 1. Sticky offline banner

`useOnlineStatus` reports online as `navigator.onLine && socket.connected`
(`app/src/hooks/useOnlineStatus.ts:18`). The screenshot shows `/api/v1/version`
returning 200 while the banner is up, so `navigator.onLine` is true and the
**socket is the failing signal**.

The socket never comes back because:

- The API disconnects sockets **server-side** in five places — the 60s session
  revalidation sweep (`api/src/services/syncService.ts:63-82`), `isSessionValid`
  (lines 49-61), and the `task:update` / `task:delete` authorization guards
  (lines 189-201).
- socket.io-client **does not auto-reconnect** when the server closes the
  connection (`reason === "io server disconnect"`). That is by design.
- Nothing on the client reconnects it: `socket.ts` registers no `disconnect`
  handler, and `AuthContext` only calls `connectSocket()` when `isAuthenticated`
  changes (`app/src/contexts/AuthContext.tsx:50-56`).

Result: the socket is dead until a manual page reload. Beyond the banner, this
also makes `isOnlineForSync()` (`app/src/utils/offlineQueue.ts:226`) false, so
every mutation gets queued locally instead of being sent.

Secondary contributor: background tabs get their timers throttled, so even the
reconnect attempts socket.io *does* schedule (for `transport close` /
`ping timeout`) can be delayed for a long time, and nothing forces a reconnect
when the tab is focused again or when `online` fires.

### 2. Repeated version requests

`useVersionCheck` (`app/src/hooks/useVersionCheck.ts:34-55`) owns a per-mount
`setInterval` plus an immediate fetch. So:

- Every consumer (and React StrictMode's double mount in dev) starts its own
  interval and its own request — no dedupe, no single-flight.
- It polls while the tab is hidden and while the browser is offline.
- It keeps polling forever, even after an update has already been detected —
  there is nothing left to learn at that point.

## Approach

### A. Make the socket self-heal (`app/src/utils/socket.ts`)

- Declare reconnection options explicitly (infinite attempts, 500ms → 10s backoff).
- Track intent (`wantConnected`), set by `connectSocket()` / `disconnectSocket()`,
  so recovery never resurrects a socket the app deliberately closed (logout).
- On `disconnect` with reason `io server disconnect`, schedule a manual reconnect
  with exponential backoff (1s → 30s, reset on a successful `connect`).
- Force an immediate reconnect attempt on the signals that mean "the user is back":
  `window online`, `document visibilitychange → visible`, and `pageshow` (bfcache).
- Keep the existing `UNAUTHORIZED` `connect_error` path as the terminal state: it
  clears intent and reports through `notifyUnauthorized()`.

This also fixes the dead-session case correctly: a reconnect after a server-side
revalidation kill either succeeds (session still valid — the banner was a lie) or
fails the handshake with `UNAUTHORIZED`, which logs the user out instead of
leaving them staring at a permanent "Offline".

### B. Stop the banner flashing on brief socket blips (`OfflineIndicator.tsx`)

Grace period depends on the cause: a real `navigator.onLine === false` shows after
500ms as today, while a socket-only outage waits ~3s so a normal reconnect never
paints a banner at all.

### C. One shared version poller (`app/src/hooks/useVersionCheck.ts`)

Move the polling loop to module scope with a subscriber set:

- One interval and one in-flight request regardless of how many components use
  the hook (fixes StrictMode double-fetch too).
- Skip polls while `document.hidden` or `navigator.onLine === false`.
- Poll on regaining visibility / connectivity, rate-limited to at most one
  request per minute.
- Stop polling permanently once an update is detected.

## Out of scope

- The server-side `socket.disconnect()` call sites stay as they are; they are
  correct, the client just has to cope with them.
- The in-flight `UpdateToast` / sidebar indicator redesign already in the working
  tree is untouched beyond the hook it consumes.
