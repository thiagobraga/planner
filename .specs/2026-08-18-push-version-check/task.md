# Tasks - Push-based app version check

## Backend

- [ ] `syncService.ts`: add `VERSION_CHANNEL` const + import `LATEST_VERSION`
- [ ] `syncService.ts`: add `publishVersionAnnouncement(version)` helper
- [ ] `syncService.ts`: emit `version` to socket on `connection`
- [ ] `syncService.ts`: subscribe to `VERSION_CHANNEL`, `io.emit('version', ...)` on message (with malformed-JSON guard)
- [ ] `index.ts`: call `publishVersionAnnouncement(LATEST_VERSION)` in `start()` after `attachSyncServer`

## Frontend

- [ ] `useVersionCheck.ts`: rewrite to one-shot REST baseline + socket `'version'` listener, delete interval/wake/visibility polling logic

## Tests (TDD - red before green)

- [ ] `syncService.server.test.ts`: multi-channel Redis mock, `emit` on mockIO, new version-channel test cases
- [ ] `useVersionCheck.test.ts`: full rewrite per plan.md's 7 cases
- [ ] Sanity check `UpdateToast.test.tsx` and `TaskItem.test.tsx` still pass unmodified

## Verification

- [ ] `docker compose exec api npm test` green
- [ ] `docker compose exec app npm test` green
- [ ] Manual: 2 tabs open, restart `api` container, confirm toast appears without reload/wait
- [ ] Manual: fresh 3rd tab after restart shows banner immediately on connect
- [ ] Network panel: single `/api/v1/version` request per tab load, no recurring polling
