# PWA Support (incl. Offline Editing)

**Status:** Ready for implementation
**Dependencies:** None
**Supersedes:** `.specs/2026-05-16-28.offline-support/tasks.md` (requirements 27.6, 27.7 folded in below; that file is deprecated, not deleted)
**Estimated scope:** 3 stages — installable manifest/SW, asset caching, offline indicator + mutation queue

## Context

Planner has no PWA capability today: no manifest, no service worker, no offline handling anywhere in `app/`. `app/src/contexts/AuthContext.tsx` ties the Socket.IO connection strictly to `isAuthenticated` state with no `online`/`offline` browser event handling at all.

A prior stub spec, `.specs/2026-05-16-28.offline-support/tasks.md`, captured two open requirements — an offline indicator and an IndexedDB mutation queue — but was never designed (no `plan.md`, inconsistent plural filename, no analysis against the real architecture). Rather than run two overlapping specs, this spec absorbs and completes that work as its Stage 3, under the current requirement IDs (27.6, 27.7).

Goal: let users install Planner as an app (add-to-homescreen/desktop) in supporting browsers, have the app shell load without a network connection, and allow task edits made while offline to queue and replay in order once connectivity returns — all without breaking the existing realtime sync architecture (REST → `publishEvent()` → Redis Pub/Sub → Socket.IO → `useSync.ts` → React Query/Zustand).

Icon asset files (192x192, 512x512, maskable variants) are **out of scope for implementation** — the user will supply these separately. This plan specifies the exact paths/sizes/purposes required so integration is a drop-in once files exist.

## Architecture Decisions

1. **Tooling:** `vite-plugin-pwa` (workbox-based, Vite-native build integration) for the service worker, using the `generateSW` strategy (no custom SW logic needed — precaching only).
2. **Manifest authored by hand** as a static `app/public/manifest.webmanifest` file rather than plugin-generated, for full transparency/control given the app's strict CSP (`app/index.html:7`).
3. **SW scope stays limited to asset precaching.** The offline mutation queue is implemented entirely in main-thread JS + IndexedDB, independent of the service worker. This avoids fighting workbox's request-interception model against the app's existing REST + Socket.IO sync flow, and keeps it consistent with the existing optimistic-update architecture already living in `app/src/stores/optimistic.ts`.
4. **Replay reuses the existing sync loop.** Queued mutations, once replayed, produce a normal REST response; server-side `publishEvent()` → Redis → Socket.IO → `useSync.ts` remains the *only* path that reconciles state. The queue's sole job is firing the deferred REST call — it must never directly patch Zustand/React Query state, which would risk duplicate or conflicting events against the authoritative sync fanout.
5. **Offline detection combines two signals.** `navigator.onLine` alone is unreliable (true even when the API server is unreachable on a broken LAN link with internet otherwise up). Combine it with the Socket.IO connection state: report "offline" if either signal says so, so the offline indicator reliably appears within the 5-second requirement (27.6).

## Stage 1 — Installable PWA

Goal: app passes Lighthouse's "Installable" PWA criteria. No offline behavior yet.

#### [NEW] `app/public/manifest.webmanifest`
```json
{
  "name": "Planner",
  "short_name": "Planner",
  "description": "A task manager with a paper-journal aesthetic",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f5f0e8",
  "theme_color": "#f5f0e8",
  "icons": [
    { "src": "/images/pwa-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/images/pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/images/pwa-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
Icon files listed above do not exist yet (user-supplied later); manifest references them by path so no further edit is needed once files land in `app/public/images/`.

#### [MODIFY] `app/index.html`
- Add inside `<head>`:
  - `<link rel="manifest" href="/manifest.webmanifest">`
  - `<meta name="theme-color" content="#f5f0e8">`
  - `<link rel="apple-touch-icon" href="/images/pwa-192x192.png">`
- Extend the CSP meta tag (line 7) to add `worker-src 'self'` explicitly. Not strictly required (worker-src falls back through child-src → script-src → default-src, all `'self'`), but explicit is safer against browser inconsistency and self-documents intent.

#### [MODIFY] `app/vite.config.ts`
- Add `VitePWA` plugin import from `vite-plugin-pwa`.
- Config: `registerType: 'autoUpdate'`, `manifest: false` (using the static file above instead of plugin-generated manifest), `injectRegister: false` (registering manually in `main.tsx` for control).

#### [MODIFY] `app/src/main.tsx`
- Before/alongside `ReactDOM.createRoot(...).render(...)`, add:
  ```ts
  import { registerSW } from 'virtual:pwa-register';
  registerSW({ immediate: true });
  ```

#### [MODIFY] `app/package.json`
- Add `vite-plugin-pwa` as a devDependency.

**Verification:**
- `docker compose exec app npm run build && docker compose exec app npm run preview`
- Chrome DevTools → Application → Manifest: no parse errors, fields resolve.
- Application → Service Workers: SW registered, activated.
- Console: no CSP violation errors.
- Lighthouse PWA audit: manifest/SW checks pass; icon checks will flag until real icon files are supplied.

## Stage 2 — Asset Caching (offline app shell)

Goal: static JS/CSS/fonts/icons are cached by the SW so the app shell renders under DevTools "Offline" throttling (no crash, no browser error page — though data views will be empty since API calls still fail).

#### [MODIFY] `app/vite.config.ts`
- Extend the `VitePWA` config with:
  ```ts
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts-stylesheets' },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          cacheableResponse: { statuses: [0, 200] },
          expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  }
  ```
- Deliberately **no** `runtimeCaching` rules for `/api/*` or `/socket.io/*` — API/socket traffic is not cached at this layer; that's handled by the Stage 3 queue instead.

**Verification:**
- Load the app once online (populates cache), then DevTools → Network → "Offline" → hard reload.
- App shell (last-rendered UI or login page) renders instead of the browser's default offline error page.
- Application → Cache Storage: precache entries present for built JS/CSS bundles and Google Fonts.
- Re-run Lighthouse PWA audit — offline-capable checks improve.

## Stage 3 — Offline Indicator + Mutation Queue (absorbs offline-support spec)

Goal: satisfy requirements 27.6 (offline indicator visible within 5s of connectivity loss) and 27.7 (queue edits in IndexedDB, replay in order on reconnection), from the deprecated `.specs/2026-05-16-28.offline-support/tasks.md`.

#### [NEW] `app/src/hooks/useOnlineStatus.ts`
- Combines `window.addEventListener('online'/'offline', ...)` with the Socket.IO connection state (imported from `app/src/utils/socket.ts`). Returns `boolean` — `true` only when both the browser reports online AND the socket is connected (or has not yet failed to connect). Offline as soon as either signal reports it, satisfying the 5s requirement even when only the API/socket link (not the whole internet) is down.

#### [NEW] `app/src/components/OfflineIndicator.tsx`
- Consumes `useOnlineStatus`. Renders a small fixed banner/pill when offline, on-brand (cream/ink/accent palette per `DESIGN.md`, no box-shadow, Lora font). Mounted once, globally, in `app/src/App.tsx`.

#### [NEW] `app/src/utils/offlineQueue.ts`
- Raw IndexedDB wrapper (no new dependency — a single object store doesn't need the `idb` package).
- DB name: `planner-offline-queue`. Object store: `mutations`, `keyPath: 'id'` (uuid).
- Record shape: `{ id: string, method: 'POST'|'PATCH'|'PUT'|'DELETE', path: string, body: string, createdAt: number }`.
- Exports: `enqueueMutation(op)`, `getQueuedMutations(): Promise<QueuedMutation[]>` (sorted by `createdAt` ascending), `removeMutation(id)`.

#### [NEW] `app/src/hooks/useOfflineQueueReplay.ts`
- Triggered on the socket's `connect` event (preferred over the raw browser `online` event, since it confirms the API is actually reachable, not just that *some* network link is up).
- Reads queue via `getQueuedMutations()`, replays each through `client.ts`'s existing `request()` in FIFO order.
- Stops on first failure (preserves ordering — does not skip ahead or reorder).
- Removes each mutation from IndexedDB immediately after its replay succeeds.

#### [MODIFY] `app/src/api/client.ts`
- Inside the shared `request()` function (`client.ts:8-28`), add an offline branch for write methods (`POST`/`PATCH`/`PUT`/`DELETE`): when offline (per the same combined signal used by `useOnlineStatus`, exposed via a small module-level flag/subscription rather than a hook, since `client.ts` isn't a React module), call `offlineQueue.enqueueMutation(...)` instead of `fetch`, and resolve **immediately** with a synthetic result matching the shape the caller expects (e.g. echoing back the request body merged with any client-supplied id).
- Resolving immediately (not waiting on network) is required: `runOptimistic` (`app/src/stores/optimistic.ts:56-73`) races `call()` against a `revertTimeoutMs` timeout (default 2000ms). If the queued call didn't resolve promptly, the optimistic UI update would spuriously revert after 2s even though the edit was correctly queued.
- GET requests are unaffected — reads simply fail normally under React Query's existing retry/staleTime handling.

#### [MODIFY] `app/src/contexts/AuthContext.tsx`
- Add `online`/`offline` listeners (or consume `useOnlineStatus`) to call `connectSocket()` proactively on `online`, rather than relying solely on Socket.IO's own reconnection backoff.
- Wire `useOfflineQueueReplay`'s replay trigger to the socket's `connect` event so replay happens as soon as the connection is genuinely restored.

#### [MODIFY] `app/src/utils/socket.ts`
- Optionally expose a `connect`/`reconnect` callback registration (if not already ergonomic to subscribe to from `AuthContext`), so the queue-replay hook can react to a real reconnect rather than the browser's `online` event alone.

**Verification:**
- DevTools → Network → Offline. Create/edit/complete/delete a task.
  - `OfflineIndicator` appears within 5 seconds.
  - UI updates optimistically via the existing `runOptimistic` path even though no network request succeeds.
  - Application → IndexedDB → `planner-offline-queue` → `mutations` shows queued entries in creation order.
- Switch back to Online.
  - Socket reconnects (dev console shows connect log).
  - Queued mutations replay in original order (check Network tab request order/timing).
  - IndexedDB queue empties.
  - No duplicate tasks/events appear — verify against `useSync.ts`'s existing dedupe-by-event-id logic; replayed REST calls must produce fresh server-side `publishEvent()` calls with new event ids, not duplicates of an earlier optimistic id.
- Multi-tab regression: two tabs authenticated as the same user; go offline in tab A, edit, reconnect; confirm tab B receives the eventual sync events normally (Stage 3 must not break existing multi-client fanout).
- `docker compose exec app npm test`: existing `app/src/stores/__tests__/optimistic.test.ts` (or equivalent) still passes; add new unit tests for `offlineQueue.ts` (enqueue/replay ordering) and `useOnlineStatus.ts`.

## Deprecating the old offline-support stub

Add this banner to the top of `.specs/2026-05-16-28.offline-support/tasks.md`:
```
> Superseded by .specs/2026-07-14-pwa-support/ — do not implement from this file.
```
Its two items and requirement IDs (27.6, 27.7) are preserved verbatim inside Stage 3 above/`task.md` for traceability. The file itself is kept (not deleted) as a historical record.

## Files Changed Summary

| File | Action | Description |
|---|---|---|
| `app/public/manifest.webmanifest` | NEW | Web app manifest |
| `app/index.html` | MODIFY | manifest link, theme-color, apple-touch-icon, CSP worker-src |
| `app/vite.config.ts` | MODIFY | `vite-plugin-pwa` config (Stage 1 + Stage 2 workbox options) |
| `app/src/main.tsx` | MODIFY | SW registration |
| `app/package.json` | MODIFY | add `vite-plugin-pwa` devDependency |
| `app/src/hooks/useOnlineStatus.ts` | NEW | combined online/socket status hook |
| `app/src/components/OfflineIndicator.tsx` | NEW | offline banner UI |
| `app/src/utils/offlineQueue.ts` | NEW | IndexedDB mutation queue |
| `app/src/hooks/useOfflineQueueReplay.ts` | NEW | replay-on-reconnect logic |
| `app/src/api/client.ts` | MODIFY | offline-branch in `request()` |
| `app/src/contexts/AuthContext.tsx` | MODIFY | online/offline listeners, replay trigger wiring |
| `app/src/utils/socket.ts` | MODIFY (optional) | expose connect/reconnect callback |
| `app/src/App.tsx` | MODIFY | mount `OfflineIndicator` |
| `.specs/2026-05-16-28.offline-support/tasks.md` | MODIFY | deprecation banner |

## Verification (end-to-end)

1. `docker compose exec app npm run build && docker compose exec app npm run preview` — Lighthouse PWA audit run against the preview build.
2. Manual browser install (Chrome "Install app" prompt) once icon files are supplied.
3. DevTools offline throttling walkthrough per Stage 2 and Stage 3 verification steps above.
4. `docker compose exec app npm test` and `docker compose exec api npm test` both green.
5. `docker compose exec api npm run lint && docker compose exec app npm run lint` and `docker compose exec api npm run build && docker compose exec app npm run build` clean across the repo.
