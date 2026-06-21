# Refine Planner — Tasks

Ordered for safest dependency flow: fast low-risk fixes first, core feature next, the disruptive
build migration isolated near the end, infra last. Commit per feature/fix/group (Conventional
Commits); do not push.

## M1 — Quick Fixes & CSS Polish (low risk, fast wins)
- [ ] Verify recurring tasks repeat correctly on Daily/Today (bug fixed in aa73b0b); add a
      timezone/DST edge-case test in api taskService.sync test if missing
- [ ] "Add task…" placeholder uses same light tone as completed tasks (var(--color-ink-light))
- [ ] Enlarge the completed-task "x" mark slightly
- [ ] `.sidebar-drawer` padding: 24px 4px 24px 12px
- [ ] Extract a single `kbd` CSS class (padding: 0 5px) in index.css; replace 3 inline kbd styles
      (AppShell.tsx, Sidebar.tsx, QuickAdd.tsx)
- [ ] Move body dotted-grid background rules from `body` → `.main-content` (index.css)
- [ ] Modernize index.css: native CSS nesting, group tokens, remove dead rules

## M2 — Projects Page (feature; backend already done, frontend only)
- [ ] api/client.ts: add fetchProjects + apiCreateProject/Update/Delete/Archive (mirror task fns)
- [ ] stores/projectStore.ts: Zustand store (tree: id, name, color, parentId, children, order)
- [ ] AppShell: load projects on mount, pass to Sidebar (replace DEFAULT_PROJECTS=[])
- [ ] hooks/useSync: handle "project" entity events (invalidate/update store)
- [ ] pages/ProjectsPage.tsx: same layout as Daily/Inbox, filtered to project's tasks; wire
      /project/:id route in App.tsx (replace InboxPage stand-in)
- [ ] Sidebar project actions: add (easy), rename, delete-with-confirmation, reorder (dnd-kit),
      nest/un-nest; protect Inbox (no rename/delete)
- [ ] Persist reorder/nest/rename/delete to API; optimistic update + sync
- [ ] Seed example projects + tasks (api/src/db/seed.ts)

## M3 — Build Tooling: Vite → Webpack (breaking; isolate; do after M1–M2 committed)
- [ ] Add webpack + dev-server config: babel/ts-loader, css/postcss-loader with Tailwind v4,
      asset handling, /api + /socket.io proxy (parity with vite.config.ts)
- [ ] Dev-only: HMR + sourcemaps; prod: minified, no sourcemaps
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
