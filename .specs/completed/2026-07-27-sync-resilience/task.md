# Tasks

## A. Socket self-heal

- [x] `socket.ts`: explicit reconnection options + `wantConnected` intent flag
- [x] `socket.ts`: reconnect with backoff on `io server disconnect`
- [x] `socket.ts`: force reconnect on `online`, `visibilitychange → visible`, `pageshow`
- [x] `socket.ts`: clear intent + backoff timer on `UNAUTHORIZED` and on `disconnectSocket()`
- [x] Tests in `app/src/utils/__tests__/socket.test.ts` for each of the above

## B. Banner grace period

- [x] `OfflineIndicator.tsx`: 500ms delay when `navigator.onLine === false`, 3s when only the socket is down
- [x] Tests in `app/src/components/__tests__/OfflineIndicator.test.tsx`

## C. Shared version poller

- [x] `useVersionCheck.ts`: module-level poller, single interval, single-flight
- [x] `useVersionCheck.ts`: skip while hidden/offline; poll on visible/online with 60s rate limit
- [x] `useVersionCheck.ts`: stop polling once an update is detected
- [x] Tests in `app/src/hooks/__tests__/useVersionCheck.test.ts`

## D. Verification

- [x] `docker compose exec app npm test` — 86 files, 729 tests passing
- [x] `docker compose exec app npm run lint` — 0 errors, 29 warnings (unchanged baseline)
- [x] `docker compose exec app npm run build`
- [x] Live on `https://planner.local`:
  - server-initiated socket kill (collection guard in `syncService.ts`) → socket
    reconnected with a new id ~1s later, banner never appeared
  - `Offline` network emulation → banner appeared; back online → banner cleared,
    socket reconnected, no extra `/version` request (60s rate limit held)
  - revoked session in the DB → the 60s revalidation sweep killed the socket, the
    reconnect handshake came back `UNAUTHORIZED`, and the tab logged out to
    `/login` in ~54s instead of sitting on a stale "Offline" banner
  - `/api/v1/version` request count over a full session: 1
