# Tasks - Push-based app version check

## Backend

- [x] `syncService.ts`: add `VERSION_CHANNEL` const + import `LATEST_VERSION`
- [x] `syncService.ts`: add `publishVersionAnnouncement(version)` helper
- [x] `syncService.ts`: emit `version` to socket on `connection`
- [x] `syncService.ts`: subscribe to `VERSION_CHANNEL`, `io.emit('version', ...)` on message (with malformed-JSON guard)
- [x] `index.ts`: call `publishVersionAnnouncement(LATEST_VERSION)` in `start()` after `attachSyncServer`

## Frontend

- [x] `useVersionCheck.ts`: rewrite to one-shot REST baseline + socket `'version'` listener, delete interval/wake/visibility polling logic

## Tests (TDD - red before green)

- [x] `syncService.server.test.ts`: multi-channel Redis mock, `emit` on mockIO, new version-channel test cases
- [x] `useVersionCheck.test.ts`: full rewrite per plan.md's 7 cases
- [x] Sanity check `UpdateToast.test.tsx` and `TaskItem.test.tsx` still pass unmodified

## Verification

- [x] `docker compose exec api npm test` green
- [x] `docker compose exec app npm test` green
- [x] Manual: 2 tabs open, restart `api` container, confirm toast appears without reload/wait
- [x] Manual: fresh 3rd tab after restart shows banner immediately on connect
- [x] Network panel: single `/api/v1/version` request per tab load, no recurring polling
