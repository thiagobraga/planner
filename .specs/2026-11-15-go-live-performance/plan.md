# Go-live performance

## Why
Before go-live we measured the Daily page with Lighthouse (desktop, `/daily/list`) and with a DevTools trace. Scores are already high (Performance 99, Accessibility 97, Best Practices 100, SEO 83, Agentic 50), but the Daily page does more work than it needs to. Task rows show a collection and section chip ("finance | Contas da Mari"), and that data arrives late, in extra requests after the list has rendered. The late chip also shifts the layout.

## What changes for the user
- Daily tasks show their collection and section names as soon as the list appears. No second wave of requests, no shifting badges.
- Collections are loaded only when the user opens the move menu or starts dragging toward the Inbox.
- Text uses the cream-and-brick design with a readable version label in the top bar.
- The Lora serif loads from our own server. Playpen Sans and Hubballi load only when a user picks them or opens Settings > Appearance.
- Settings, Admin, Styleguide, Changelog, Help, Habits and Collections load on demand, so the first screen downloads less JavaScript.
- Search engines and AI crawlers get a real `robots.txt`, a page description, and clean 404s instead of the app shell.
- Production responses carry security headers (CSP, HSTS, COOP, frame and content-type protections).
- Date and time formatting on Daily, Habits and the nav icons is cheaper per render.

## Scope
Three pull requests, each on its own worktree and branch:

1. `perf/daily-chip-names`: API returns collection and section names with each daily task. The Daily page reads them and stops requesting `/collections/:id/sections`. Collections load lazily.
2. `perf/lighthouse-go-live`: contrast fix on the version label, self-hosted Lora, lazy font loading for the other families, route code splitting, SEO files and meta, security headers in the production router.
3. `perf/runtime-hotspots`: cache `Intl` formatters, cheaper toolbar resize handling, and check whether the Daily query waits on preferences before it starts.

## Not in scope
- Source maps for the production bundle (Lighthouse weight 0).
- Dev-server module count (208 unbundled modules). Dev only.
- Duplicate `auth/me` and `version` calls under React StrictMode. Dev only. Optional follow-up.
- Collections and Inbox pages that need the full collections list.

## Decisions
- Version label: remove the explicit color so it inherits the parent. Design tokens are unchanged.
- Fonts: Lora is preloaded. Playpen Sans and Hubballi are not preloaded.
- Headers: change the repo router config (`compose.prod.yml`). Host nginx is unchanged; the HSTS line for host nginx is documented in the README.
- `/llms.txt` and `/ai-catalog.json` return 404 for this private app.
- Task payload names are optional fields. Create, update and sync payloads that do not include names keep working.
- Dot color: `--color-dot` is shared. Consumers: dot grid background (`AppShell.tsx`, `index.css`), habit dots (`HabitDot.tsx`), topbar borders and version chip (`TopBar.css`), dividers, chip and toggle borders (`index.css`). Do not change its value to fix one component. A component that needs a different dot color gets its own semantic token (name describes the role, not the component, e.g. `--color-dot-grid-subtle`), set on that component's element. The shared token keeps its value.

## Relevant Files
API
- `api/src/services/dailyService.ts` (daily query, `:47-63`)
- `api/src/services/viewService.ts` (`TaskRow`, `formatTask`, `:9-31`, `:60-84`)
- `api/src/mcp/format.ts` (already reads `collectionName`)
- `compose.prod.yml` (router, security headers)

App
- `app/src/pages/DailyPage.tsx` (chip, sections query, move menu)
- `app/src/components/nav/TopBarItem.tsx` (Inbox drop target, collections query)
- `app/src/components/ui/Chip.tsx`
- `app/src/types/api.ts` (`ApiTask`)
- `app/src/hooks/useSync.ts` (rename and delete invalidation)
- `app/src/utils/date.ts` (`fmtISOInTimeZone`, `getTimeZoneOffsetMs`)
- `app/src/components/toolbar/PageToolbar.tsx` (resize observer)
- `app/src/App.tsx` (route lazy loading)
- `app/src/contexts/AuthContext.tsx` (startup order)
- `app/src/hooks/useDailyView.ts`
- `app/src/index.css` (`.topbar-version`, `--color-dot` consumers at `:148`, `:198`, `:429`, `:450`)
- `app/src/components/AppShell.tsx` (dot grid background, `:249`)
- `app/src/components/habits/HabitDot.tsx` (border `--color-dot`, `:49`, `:60`)
- `app/src/components/nav/TopBar.css` (`--color-dot` borders, `:8`, `:21`, `:75`, `:102`)
- `app/index.html` (font links, meta description)
- `app/public/robots.txt` (new)
- `vite.config.ts` (PWA precache for fonts)
- `README.md` (host nginx HSTS note)

Evidence: `/home/thiago/Downloads/performance-planner` (DevTools trace), Lighthouse report from `planner.thiagobraga.dev/daily/list`.

## Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` completed.

### 0. Setup (per PR)
- [ ] 0.1 Worktree and branch: `git worktree add .worktrees/<slug> -b <branch>` for `perf/daily-chip-names`, `perf/lighthouse-go-live`, `perf/runtime-hotspots`
- [ ] 0.2 Copy `.env.example` to `.env`; set `COMPOSE_PROJECT_NAME=planner-<agent>`, `APP_SUBDOMAIN=<agent>.planner`
- [ ] 0.3 Add new subdomain to `/p/linux/scripts/mkcert.conf` if needed, run `bash /p/linux/scripts/mkcert-local`, `docker restart traefik`
- [ ] 0.4 `bash .hooks/setup-hooks.sh`; `docker compose up -d`
- [ ] 0.5 Draft PR against `main` per branch

### 1. PR `perf/daily-chip-names`

#### 1.1 API (TDD: integration test first, real DB)
- [ ] 1.1.1 Test: daily view returns `collectionName`, `collectionColor`, `sectionName` for sectioned task; omits `sectionName` for unsectioned; reflects renamed collection and section
- [ ] 1.1.2 `dailyService.ts`: select `p.name AS collection_name`, `p.color AS collection_color`, `s.name AS section_name`; add `LEFT JOIN sections s ON s.id = t.section_id`
- [ ] 1.1.3 `viewService.ts`: extend `TaskRow` with optional name fields; `formatTask` emits `collectionName`, `collectionColor`, `sectionName` when present
- [ ] 1.1.4 Confirm `taskService` create, update and sync payloads still validate without names
- [ ] 1.1.5 `mcp/format.ts`: use `task.collectionName` on `get_today` / `get_upcoming`; drop `collectionNameMap` lookup in `mcp/tools/views.ts` if now redundant

#### 1.2 Frontend (TDD)
- [ ] 1.2.1 `types/api.ts`: add optional `collectionName`, `collectionColor`, `sectionName` to `ApiTask`
- [ ] 1.2.2 Test: chip renders from task fields; no request to `/collections/:id/sections`
- [ ] 1.2.3 `DailyPage.tsx`: build chip from task fields; remove `useQueries` over `fetchSections` and `sectionNames` map
- [ ] 1.2.4 `DailyPage.tsx`: `collections` query `enabled` only when move menu opens
- [ ] 1.2.5 `TopBarItem.tsx`: fetch collections (for Inbox drop target) only when a drag starts
- [ ] 1.2.6 `hooks/useSync.ts`: collection and section rename or delete events invalidate `['daily']`

#### 1.3 Verification
- [ ] 1.3.1 Playwright: `/daily/list` makes no `/collections` or `/sections` request until move menu or drag
- [ ] 1.3.2 `npm test` (api and app), lint, build
- [ ] 1.3.3 Desktop and 390px screenshots in `app/dist/screenshots/`; check chip layout shift is gone
- [ ] 1.3.4 Mark PR ready for review

### 2. PR `perf/lighthouse-go-live`

#### 2.1 Contrast
- [ ] 2.1.1 Remove `color` from `.topbar-version` in `app/src/index.css` (or topbar CSS) so it inherits the parent
- [ ] 2.1.2 Verify contrast >= 4.5:1 for the label
- [ ] 2.1.3 Dot color: do not edit shared `--color-dot` for one component. Add a semantic dot token where a component needs a different dot color; verify each consumer above (AppShell grid, HabitDot, TopBar, index.css) renders unchanged in light and dark

#### 2.2 Fonts
- [ ] 2.2.1 Add Lora (latin subset, woff2) via `@fontsource-variable/lora` or `app/public/fonts`
- [ ] 2.2.2 Preload the regular Lora file in `app/index.html`
- [ ] 2.2.3 Remove Google Fonts `<link>` and preconnects from `app/index.html`
- [ ] 2.2.4 Playpen Sans and Hubballi: no preload; `@font-face` loaded via dynamic import only when the saved font preference uses them, or when Settings > Appearance opens
- [ ] 2.2.5 Add woff2 to PWA precache in `vite.config.ts`; runtime-cache lazy fonts
- [ ] 2.2.6 Verify offline load in the PWA

#### 2.3 Code splitting
- [ ] 2.3.1 `App.tsx`: `React.lazy` for Settings, Admin, Styleguide, Changelog, Help, Habits, Collections; Suspense fallback
- [ ] 2.3.2 Compare `vite build` chunk sizes before and after (baseline ~1MB JS)

#### 2.4 SEO and crawlers
- [ ] 2.4.1 `app/index.html`: `<meta name="description">`
- [ ] 2.4.2 `app/public/robots.txt` (valid syntax; no `<html>` body)
- [ ] 2.4.3 Return 404 for `/llms.txt` and `/ai-catalog.json` instead of the SPA shell (router or static file rule)

#### 2.5 Security headers
- [ ] 2.5.1 `compose.prod.yml` router: CSP (report-only first), HSTS, COOP, `X-Content-Type-Options`, `frame-ancestors`
- [ ] 2.5.2 Verify app still loads with CSP (Socket.IO, fonts, inline manifest script in `index.html`)
- [ ] 2.5.3 `README.md`: document HSTS line for host nginx (host nginx unchanged)

#### 2.6 Verification
- [ ] 2.6.1 Lighthouse desktop and mobile, incognito, against worktree prod build: CLS 0, contrast pass, no render-blocking Google CSS, SEO and Agentic scores up
- [ ] 2.6.2 Tests, lint, build; Playwright for fonts and 404 paths
- [ ] 2.6.3 Screenshots desktop and 390px

### 3. PR `perf/runtime-hotspots`

#### 3.1 Date formatting
- [ ] 3.1.1 Test: `fmtISOInTimeZone` and `getTimeZoneOffsetMs` return same values with cached formatters
- [ ] 3.1.2 `utils/date.ts`: cache `Intl.DateTimeFormat` per timezone in a `Map`
- [ ] 3.1.3 Confirm callers `navIcons.tsx`, `DailyPage.tsx`, `HabitsPage.tsx`, `dailySections.ts` unchanged

#### 3.2 Toolbar resize
- [ ] 3.2.1 `PageToolbar.tsx`: skip update when width unchanged; batch reads before writes
- [ ] 3.2.2 Test: no extra state update on same-width resize callback

#### 3.3 Startup order
- [ ] 3.3.1 Check whether `/daily` waits for `preferences` before the daily query (range from `dailyView`)
- [ ] 3.3.2 If it waits: start the daily query with default range from cache or prefetch preferences alongside `auth/me` (`AuthContext.tsx`, `hooks/useDailyView.ts`)
- [ ] 3.3.3 Verify request order in trace: `daily` starts before `preferences` resolves

#### 3.4 Verification
- [ ] 3.4.1 Tests, lint, build
- [ ] 3.4.2 Trace comparison: `Intl` self time and layout time reduced
- [ ] 3.4.3 Mark PR ready for review

### 4. Deferred (not in this release)
- [ ] 4.1 StrictMode duplicate `auth/me` and `version` in dev (optional in-flight dedupe)
- [ ] 4.2 Source maps for prod bundle
