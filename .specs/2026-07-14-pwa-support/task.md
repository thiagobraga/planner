# PWA Support (incl. Offline Editing)

Legend: `[ ]` to-do · `[~]` in progress · `[x]` completed

- [ ] Stage 1: Installable manifest + minimal service worker
  - [ ] Create `app/public/manifest.webmanifest`
  - [ ] Update `app/index.html`
    - [ ] `<link rel="manifest">`
    - [ ] `<meta name="theme-color" content="#f5f0e8">`
    - [ ] `<link rel="apple-touch-icon">`
    - [ ] Add `worker-src 'self'` to CSP meta tag
  - [ ] Add `vite-plugin-pwa` devDependency to `app/package.json`
  - [ ] Configure `VitePWA` plugin in `app/vite.config.ts` (registerType: autoUpdate, manifest: false, injectRegister: false)
  - [ ] Register SW in `app/src/main.tsx` via `virtual:pwa-register`
  - [ ] Verify: `docker compose exec app npm run build && docker compose exec app npm run preview`
  - [ ] Verify: DevTools Application → Manifest (no errors)
  - [ ] Verify: DevTools Application → Service Workers (registered, activated)
  - [ ] Verify: no CSP console errors
  - [ ] Verify: Lighthouse PWA audit (manifest/SW pass)

- [ ] Stage 2: Asset caching (offline app shell)
  - [ ] Add `workbox.globPatterns` to `VitePWA` config in `app/vite.config.ts`
  - [ ] Add `runtimeCaching` rules for `fonts.googleapis.com` (CacheFirst)
  - [ ] Add `runtimeCaching` rules for `fonts.gstatic.com` (CacheFirst, 1yr expiration)
  - [ ] Confirm no `runtimeCaching` added for `/api/*` or `/socket.io/*`
  - [ ] Verify: load once online, then DevTools Offline + hard reload → app shell renders
  - [ ] Verify: Application → Cache Storage shows precached JS/CSS/fonts
  - [ ] Verify: re-run Lighthouse, offline-capable checks improve

- [ ] Stage 3: Offline indicator + mutation queue (absorbs `.specs/2026-05-16-28.offline-support`)
  - [ ] Create `app/src/hooks/useOnlineStatus.ts` (combines `navigator.onLine` + socket connection state)
  - [ ] Create `app/src/components/OfflineIndicator.tsx` (on-brand banner)
  - [ ] Mount `OfflineIndicator` in `app/src/App.tsx`
  - [ ] Create `app/src/utils/offlineQueue.ts` (IndexedDB `planner-offline-queue`/`mutations` store)
    - [ ] `enqueueMutation(op)`
    - [ ] `getQueuedMutations()` (sorted by `createdAt`)
    - [ ] `removeMutation(id)`
  - [ ] Create `app/src/hooks/useOfflineQueueReplay.ts` (FIFO replay on socket `connect`, stop on first failure)
  - [ ] Modify `app/src/api/client.ts` `request()` — offline branch for write methods, resolves immediately with synthetic result
  - [ ] Modify `app/src/contexts/AuthContext.tsx` — online/offline listeners, proactive `connectSocket()` on `online`, wire replay trigger to socket `connect`
  - [ ] Modify `app/src/utils/socket.ts` — expose connect/reconnect callback (if needed)
  - [ ] Requirement 27.6 — offline indicator visible within 5s of connectivity loss
  - [ ] Requirement 27.7 — queue edits in IndexedDB, replay in order on reconnection
  - [ ] Verify: offline task create/edit/complete/delete queues correctly, indicator appears <5s
  - [ ] Verify: IndexedDB `mutations` store shows entries in creation order
  - [ ] Verify: on reconnect, socket reconnects, queue replays in order, IndexedDB empties
  - [ ] Verify: no duplicate tasks/events (check `useSync.ts` dedupe-by-event-id)
  - [ ] Verify: multi-tab regression — tab B receives sync events normally after tab A's offline replay
  - [ ] Add unit tests: `offlineQueue.ts` (enqueue/replay ordering)
  - [ ] Add unit tests: `useOnlineStatus.ts`
  - [ ] Verify: `docker compose exec app npm test` green (including existing `optimistic.test.ts`)

- [ ] Deprecate `.specs/2026-05-16-28.offline-support/tasks.md`
  - [ ] Add superseded banner pointing to this spec
  - [ ] Keep file (do not delete) as historical record

- [ ] Final checks
  - [ ] `docker compose exec api npm run lint && docker compose exec app npm run lint` clean
  - [ ] `docker compose exec api npm run build && docker compose exec app npm run build` clean
  - [ ] `docker compose exec api npm test && docker compose exec app npm test` green
  - [ ] Manual browser install once icon files supplied
