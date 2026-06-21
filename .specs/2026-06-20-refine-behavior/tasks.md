# Refine Planner — Tasks

Ordered for safest dependency flow: fast low-risk fixes first, core feature next, the disruptive
build migration isolated near the end, infra last. Commit per feature/fix/group (Conventional
Commits); do not push.

## M1 — Quick Fixes & CSS Polish (low risk, fast wins)
- [x] Verify recurring tasks repeat correctly on Daily/Today (fixed in aa73b0b; sync test passes)
- [x] "Add task…" placeholder uses same light tone as completed tasks (opacity 0.35)
- [x] Enlarge the completed-task "x" mark slightly (22px → 26px)
- [x] `.sidebar-drawer` padding: 24px 4px 24px 12px
- [x] Extract a single `kbd` CSS class (padding: 0 5px) in index.css; replace 3 inline kbd styles
      (AppShell.tsx, Sidebar.tsx, QuickAdd.tsx)
- [x] Move body dotted-grid background rules from `body` → `.main-content` (index.css)
- [x] Modernize index.css: native CSS nesting, group tokens, remove dead rules

## M2 — Projects Page (feature; backend already done, frontend only)
- [x] api: add GET /views/project/:id; extend updateProject (parentId/orderValue + cycle guard);
      publish project sync events
- [x] api/client.ts: add fetchProjects + apiCreateProject/Update/Delete/Archive + color palette
- [x] stores/projectStore.ts: Zustand store + buildProjectTree
- [x] AppShell: invalidate projects/project queries on "project" sync events
- [x] pages/ProjectsPage.tsx: same layout as Daily/Inbox, filtered to project's tasks; route wired
- [x] Sidebar/ProjectTreeNav: add (inline), rename (double-click), delete-with-confirmation,
      add sub-project, dnd-kit reorder + nest (depth projection); Inbox excluded
- [x] Persist reorder/nest/rename/delete to API; optimistic cache updates
- [x] Seed example projects + tasks (api/src/db/seed.ts)
- [ ] Manual end-to-end verification in browser (needs running stack: postgres/redis/api/app)

## M3 — Build Tooling: Vite → Webpack (BLOCKED — needs decision)
> Blocker: the pnpm store was upgraded to v11 but node_modules are linked from the v10 store.
> Adding the webpack toolchain (~15 dev deps) requires a full monorepo `pnpm install` to migrate
> the store. Also needs browser verification (running stack). Paused for user direction.
- [ ] Add webpack + dev-server config: babel-loader, css/postcss-loader with @tailwindcss/postcss,
      asset handling, /api + /socket.io proxy (parity with vite.config.ts)
- [ ] Dev-only: HMR (react-refresh) + sourcemaps; prod: minified, no sourcemaps
- [ ] Move vitest config to vitest.config.ts (keep vite as a vitest dependency)
- [ ] Update app package.json scripts (dev/build/preview)
- [ ] Update .docker/app/Dockerfile if needed
- [ ] Verify HMR, Tailwind, sync, routing all work end-to-end

## M4 — System / Infra (independent; Docker)
- [ ] compose.yml: Traefik subdomain routers — api.planner.local (api), db.planner.local (pgadmin)
- [ ] Add pgadmin (dpage/pgadmin4:latest) with dev creds, server-mode off, auto-connect to postgres,
      depends_on postgres
- [ ] Confirm /etc/hosts entries resolve; document dev access in README/CLAUDE.md

## M5 — Inline-style Reduction (polish; opportunistic)
- [ ] Migrate high-density inline styles to Tailwind/CSS classes (TaskDetail 35, Sidebar 23,
      HabitsPage 18, LoginPage 16, QuickAdd 15…); ~202 total occurrences
