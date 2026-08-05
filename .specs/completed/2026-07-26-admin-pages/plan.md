# Admin Pages — Plan

## Context

Planner has no admin/role concept today — no `role` column on `users`, no admin
middleware, no admin routes or pages. This spec adds a minimal admin surface for two
needs: **user management** (find a user, disable/enable their account, force-logout
their sessions) and an **ops dashboard** (aggregate counts, system health, auth stats).

Deliberately out of scope, to keep this shippable as one spec:

- **Self-serve role promotion.** No UI to grant/revoke the `admin` role. Promote via
  direct SQL/seed for now — a promotion UI is a separate spec if it's ever needed.
- **Activity/audit feed.** `utils/securityLogger.ts` (`securityLog`) only writes
  structured JSON to stdout — nothing is persisted. Building a queryable audit trail
  (new table + writes from every mutating admin/auth action) is real scope on its own
  and is left for a future spec. This spec does not add a "recent activity" panel.
- **Content moderation** (inspecting/editing other users' tasks/collections/comments).

Access control: `users.role` (`'user' | 'admin'`, default `'user'`), enforced by a new
`adminAuth` middleware that runs after the existing `auth` middleware.

## Approach

### 1. Migration

`api/src/db/migrations/026_add_user_role_and_disabled.sql`:

```sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));
ALTER TABLE users ADD COLUMN disabled_at TIMESTAMPTZ;
```

Use the `db-migration` skill to author it and match numbering/house conventions —
confirm `026` is actually the next free number before writing the file.

No default admin is seeded by the migration. First admin is granted by hand:
`UPDATE users SET role = 'admin' WHERE email = '...'`.

### 2. Backend — auth changes

- `api/src/middleware/adminAuth.ts`: new middleware, mounted after `auth` on every
  `/admin/*` route. Reads `req.userId` (already set by `auth`), loads the user's `role`
  (single indexed lookup, or piggyback on a `role` field the `auth` middleware's
  existing session/user query already fetches — check `middleware/auth.ts` before
  adding a second query), 403s with `AppError` (`code: 'FORBIDDEN'`) if not `'admin'`.
- `api/src/services/authService.ts` (`login`): after credential check, reject with the
  existing invalid-credentials error shape if `disabled_at IS NOT NULL` — a disabled
  account should not reveal that it's disabled vs. just having the wrong password.
  Log via `securityLog` with a new `auth:login:failure` reason `'account-disabled'`
  (extend the existing reason union in `securityLogger.ts`).

### 3. Backend — user management

`api/src/services/adminUserService.ts`:

- `listUsers({ search?: string, cursor?: string, limit?: number })` — paginated,
  `ILIKE` search over email (and name, if one exists on `users` — check the schema).
  Returns id, email, created_at, role, disabled_at, and last-session `last_seen_at`
  (join against `sessions`, most recent row per user).
- `disableUser(userId)` — sets `disabled_at = now()`, then deletes that user's rows
  from `sessions` (same `DELETE FROM sessions WHERE user_id = $1` pattern already used
  in `authService.ts`'s password-reset flow), then `securityLog.sessionRevoked(userId,
  'admin-disable')`.
- `enableUser(userId)` — sets `disabled_at = NULL`.
- `revokeSessions(userId)` — same session delete, `securityLog.sessionRevoked(userId,
  'admin-revoke')`, without touching `disabled_at`.

`api/src/routes/adminUsers.ts`:
```
GET    /api/v1/admin/users              listUsers
POST   /api/v1/admin/users/:id/disable  disableUser
POST   /api/v1/admin/users/:id/enable   enableUser
POST   /api/v1/admin/users/:id/revoke-sessions  revokeSessions
```
All behind `auth` + `adminAuth`. No `publishEvent()` — these aren't collaborative
entities other sessions need to sync on (the affected user simply loses their session
on next request, which the existing `auth` middleware's DB session check already
enforces without any new sync plumbing).

### 4. Backend — ops dashboard

`api/src/services/adminStatsService.ts`:

- `getCounts()` — one query per table (`users`, `tasks`, `collections`, `habits`)
  or a single query with `UNION ALL` sub-selects; either is fine at current scale.
- `getSystemHealth()` — `pool.totalCount` / `pool.idleCount` / `pool.waitingCount`
  from `db/pool.ts`'s exported pool, a Redis `PING` via `redisClient` with a short
  timeout (report `up`/`down`, not just throw), `process.uptime()`,
  `process.memoryUsage().rss`.
- `getAuthStats()` — active session count (`SELECT COUNT(*) FROM sessions`), and
  failed-login signal from Redis: check `rateLimitService.ts` for the key shape it
  already uses for login rate-limiting and read counts from those keys rather than
  inventing a parallel counter.

`api/src/routes/adminStats.ts`:
```
GET /api/v1/admin/stats/counts
GET /api/v1/admin/stats/health
GET /api/v1/admin/stats/auth
```
Behind `auth` + `adminAuth`. Read-only, no `publishEvent()`.

Mount both route files under `/api/v1/admin` in `routes/index.ts`.

### 5. Frontend — access gating

- `AuthContext`/`stores/authStore.ts`: extend the user shape with `role`, populated
  from whatever `/auth/login` or the session-restore endpoint already returns (check
  what `authService`/`authRoutes` sends back today — add `role` to that payload if
  it's not already there).
- `app/src/components/Sidebar.tsx`: render an "Admin" nav item only when
  `user.role === 'admin'`.
- `app/src/App.tsx`: add `/admin/users` and `/admin/dashboard` routes inside
  `AppShell`'s route tree, each wrapped in a guard that redirects to `/today` when
  `role !== 'admin'` (mirror the existing logged-out guard's redirect approach, don't
  invent a new pattern).

### 6. Frontend — pages

`app/src/pages/admin/AdminUsersPage.tsx`:
- Search input (debounced) + table: email, joined date, status (active/disabled),
  last session. Row actions: Disable/Enable (single button, label flips with state),
  Revoke sessions. Each action is a React Query mutation invalidating the user list
  query on success; no optimistic store involvement (`stores/optimistic.ts` is for
  collaborative task/collection state, not admin actions).

`app/src/pages/admin/AdminDashboardPage.tsx`:
- Three sections: count tiles, system health panel, auth stats panel. Each backed by
  its own `useQuery` (`staleTime` short, e.g. 30s, or manual refetch button — dashboard
  data goes stale faster than the 60s app-wide default) hitting the three stats
  endpoints.

`app/src/api/client.ts`: add typed wrappers — `apiListUsers`, `apiDisableUser`,
`apiEnableUser`, `apiRevokeSessions`, `apiGetAdminCounts`, `apiGetAdminHealth`,
`apiGetAdminAuthStats`.

### 7. Tests

- `api/src/services/__tests__/adminUserService.test.ts` — list/search, disable sets
  `disabled_at` + clears sessions, enable clears it, revoke clears sessions without
  touching `disabled_at`.
- `api/src/services/__tests__/adminStatsService.test.ts` — counts match seeded rows,
  health reports pool/Redis shape, auth stats reflect seeded sessions.
- `api/src/middleware/__tests__/adminAuth.test.ts` — 403 for non-admin/no-session,
  passes through for admin.
- `api/src/routes/__tests__/adminUsers.test.ts`, `adminStats.test.ts` — route-level,
  real DB per house convention.
- `api/src/services/__tests__/authService.test.ts` — add case: login rejected for
  `disabled_at IS NOT NULL`, same error shape as bad credentials.
- `app/src/pages/admin/__tests__/AdminUsersPage.test.tsx`,
  `AdminDashboardPage.test.tsx` — render, search, and action-mutation coverage.
- `app/src/components/__tests__/Sidebar.test.tsx` — extend: admin nav item hidden for
  `role: 'user'`, shown for `role: 'admin'`.

## Verification

1. `docker compose exec api npm test && docker compose exec app npm test` — all pass.
2. `docker compose exec api npm run build && docker compose exec app npm run build`.
3. Manual: promote a test user to `admin` via SQL, log in, confirm the Admin nav item
   appears and a non-admin account doesn't see it (and gets redirected on direct nav
   to `/admin/users`).
4. Manual: disable a user from `AdminUsersPage`, confirm their existing session is
   immediately invalidated (next API call gets 401) and they can't log back in.
5. Manual: `AdminDashboardPage` renders real counts/health/auth numbers matching the
   dev DB state.
