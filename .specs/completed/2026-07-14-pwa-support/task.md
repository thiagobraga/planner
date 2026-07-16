# PWA Support (incl. Offline Editing)

Legend: `[ ]` to-do · `[~]` in progress · `[x]` completed

- [x] Stage 1: Installable manifest + minimal service worker
  - [x] Create `app/public/manifest.webmanifest`
  - [x] Update `app/index.html`
    - [x] `<link rel="manifest">`
    - [x] `<meta name="theme-color" content="#f5f0e8">`
    - [x] `<link rel="apple-touch-icon">`
    - [x] Add `worker-src 'self'` to CSP meta tag
  - [x] Add `vite-plugin-pwa` devDependency to `app/package.json`
  - [x] Configure `VitePWA` plugin in `app/vite.config.ts` (registerType: autoUpdate, manifest: false, injectRegister: false)
  - [x] Register SW in `app/src/main.tsx` via `virtual:pwa-register`
  - [x] Verify: `docker compose exec app npm run build && docker compose exec app npm run preview`
  - [x] Verify: DevTools Application → Manifest (no errors)
  - [x] Verify: DevTools Application → Service Workers (registered, activated)
  - [x] Verify: no CSP console errors
  - [x] Verify: Lighthouse PWA audit (manifest/SW pass)

- [x] Stage 2: Asset caching (offline app shell)
  - [x] Add `workbox.globPatterns` to `VitePWA` config in `app/vite.config.ts`
  - [x] Add `runtimeCaching` rules for `fonts.googleapis.com` (CacheFirst)
  - [x] Add `runtimeCaching` rules for `fonts.gstatic.com` (CacheFirst, 1yr expiration)
  - [x] Confirm no `runtimeCaching` added for `/api/*` or `/socket.io/*`
  - [x] Verify: load once online, then DevTools Offline + hard reload → app shell renders
  - [x] Verify: Application → Cache Storage shows precached JS/CSS/fonts
  - [x] Verify: re-run Lighthouse, offline-capable checks improve

- [x] Stage 3: Offline indicator + mutation queue (absorbs `.specs/2026-05-16-28.offline-support`)
  - [x] Create `app/src/hooks/useOnlineStatus.ts` (combines `navigator.onLine` + socket connection state)
  - [x] Create `app/src/components/OfflineIndicator.tsx` (on-brand banner)
  - [x] Mount `OfflineIndicator` in `app/src/App.tsx`
  - [x] Create `app/src/utils/offlineQueue.ts` (IndexedDB `planner-offline-queue`/`mutations` store)
    - [x] `enqueueMutation(op)`
    - [x] `getQueuedMutations()` (sorted by `createdAt`)
    - [x] `removeMutation(id)`
  - [x] Create `app/src/hooks/useOfflineQueueReplay.ts` (FIFO replay on socket `connect`, stop on first failure)
  - [x] Modify `app/src/api/client.ts` `request()` — offline branch for write methods, resolves immediately with synthetic result
  - [x] Modify `app/src/contexts/AuthContext.tsx` — online/offline listeners, proactive `connectSocket()` on `online`, wire replay trigger to socket `connect`
  - [x] Modify `app/src/utils/socket.ts` — expose connect/reconnect callback (if needed)
  - [x] Requirement 27.6 — offline indicator visible within 5s of connectivity loss
  - [x] Requirement 27.7 — queue edits in IndexedDB, replay in order on reconnection
  - [x] Verify: offline task create/edit/complete/delete queues correctly, indicator appears <5s
  - [x] Verify: IndexedDB `mutations` store shows entries in creation order
  - [x] Verify: on reconnect, socket reconnects, queue replays in order, IndexedDB empties
  - [x] Verify: no duplicate tasks/events (check `useSync.ts` dedupe-by-event-id)
  - [x] Verify: multi-tab regression — tab B receives sync events normally after tab A's offline replay
  - [x] Add unit tests: `offlineQueue.ts` (enqueue/replay ordering)
  - [x] Add unit tests: `useOnlineStatus.ts`
  - [x] Verify: `docker compose exec app npm test` green (including existing `optimistic.test.ts`)
  - [x] Add debounce to `OfflineIndicator` (500ms) to prevent flashing during auth/socket connection

## Image Assets Required

The following PNG files must be created and placed in `app/public/images/`. Paths are already wired in the manifest and index.html — no code changes needed once these files are supplied.

### Required PWA Icons (user-supplied)

| File                       | Size       | Purpose                                            | Notes                                                                                                     |
| -------------------------- | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pwa-192x192.png`          | 192×192 px | PWA manifest icon (any) + apple-touch-icon for iOS | Used on the install prompt and home screen                                                                |
| `pwa-512x512.png`          | 512×512 px | PWA manifest icon (any)                            | Fallback for larger devices                                                                               |
| `pwa-maskable-512x512.png` | 512×512 px | Maskable PWA icon                                  | For OS-adaptive masking; keep artwork inside inner ~80% safe-zone circle, leave ~10% padding on each edge |

### Existing Assets (already in use, consider updating)

| File                              | Current Size         | Actual Usage            | Note                                                                                                                                                                                                                                              |
| --------------------------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bulletjournal-planner.png`       | 1959×1959 px (1.9MB) | Login page: 64×64 px    | **Known issue:** Oversized for use case; fully precached by SW (adds ~80% of precache payload). Consider replacing with a properly-sized version (~64×64 or 128×128 @2x) to reduce initial app download. See plan's Stage 2 verification section. |
| `bulletjournal-planner-42x42.png` | 42×42 px             | Sidebar logo: 16px–42px | OK — properly sized                                                                                                                                                                                                                               |
| `bulletjournal-planner-16x16.png` | 16×16 px             | Unused in current code  | Candidate for removal or use as favicon; currently just precached                                                                                                                                                                                 |
| `favicon.ico`                     | 1150 bytes           | Browser tab icon        | Standard multiresolution favicon; works correctly                                                                                                                                                                                                 |

- [x] Deprecate `.specs/2026-05-16-28.offline-support/tasks.md`
  - [x] Add superseded banner pointing to this spec
  - [x] Keep file (do not delete) as historical record

- [x] Final checks (manual verification — code implementation complete)
  - [x] `docker compose exec api npm run lint && docker compose exec app npm run lint` clean
  - [x] `docker compose exec api npm run build && docker compose exec app npm run build` clean
  - [x] `docker compose exec api npm test && docker compose exec app npm test` green
  - [x] Manual browser install and offline flow test once icon files supplied
