# Admin Pages — Tasks

Markers: `[ ]` not started · `[~]` in progress · `[x]` done

## Migration

- [x] `api/src/db/migrations/032_user_role_and_disabled.sql` — `users.role`
      (`'user'|'admin'`, default `'user'`) + `users.disabled_at` (nullable
      timestamptz), plus indexes on `role` and `created_at DESC`.
      Numbered 032, not 026: 026–031 were already taken.

## Backend — auth

- [x] `api/src/middleware/adminAuth.ts` — 403 if `role !== 'admin'` (or the
      account is disabled). Kept as its own query: `authMiddleware` validates an
      opaque session cookie via `sessionService` and never touches `users`, so
      widening it would add a join to every API request to save one indexed read
      on the handful of admin ones.
- [x] `api/src/services/authService.ts` (`login`) — rejects a disabled account
      after the password check, with the same message as bad credentials
- [x] `api/src/routes/auth.ts` — maps the internal `ACCOUNT_DISABLED` code back
      to `INVALID_CREDENTIALS` before it reaches the client, and logs the real
      reason; `/auth/me` now returns `role` and 401s a disabled account
- [x] `api/src/utils/securityLogger.ts` — `auth:login:failure` reason union
      extended with `'account-disabled'`

## Backend — user management

- [x] `api/src/services/adminUserService.ts` — `listUsers`, `disableUser`,
      `enableUser`, `revokeSessions`. Sessions are soft-revoked via
      `sessionService.revokeAllUserSessions` (the schema uses `revoked_at`, not
      row deletes). `disableUser` refuses to disable the acting admin.
- [x] `api/src/routes/adminUsers.ts`
- [x] Wired into `api/src/routes/index.ts` under `/admin/users` behind
      `adminAuthMiddleware` (`authMiddleware` already runs globally in index.ts)

## Backend — ops dashboard

- [x] `api/src/services/adminStatsService.ts` — `getCounts`, `getSystemHealth`,
      `getAuthStats`; failed-login figures read `rateLimitService`'s own
      `rl:acct:*` / `rl:login:ip:*` keys
- [x] `api/src/routes/adminStats.ts`
- [x] Wired into `api/src/routes/index.ts` under `/admin/stats`

## Frontend — access gating

- [x] `/auth/login` and `/auth/me` both return `role`
- [x] `app/src/api/client.ts` — `AuthUser.role`; `AuthContext` carries it
      through unchanged (no separate auth store to update)
- [x] `app/src/components/Sidebar.tsx` — Admin + Users nav items, expanded and
      collapsed, only when `role === 'admin'`
- [x] `app/src/App.tsx` — `/admin`, `/admin/dashboard`, `/admin/users` inside
      `AppShell`, redirecting non-admins to `/daily`

## Frontend — pages

- [x] `app/src/api/client.ts` — `apiListUsers`, `apiDisableUser`,
      `apiEnableUser`, `apiRevokeSessions`, `apiGetAdminCounts`,
      `apiGetAdminHealth`, `apiGetAdminAuthStats`
- [x] `app/src/pages/admin/AdminUsersPage.tsx` — debounced search, table,
      row actions with confirmation, cursor-based "Load more"
- [x] `app/src/pages/admin/AdminDashboardPage.tsx` — count tiles, health panel,
      auth panel, 30s `staleTime` + manual Refresh
- [x] i18n keys added to both `en.ts` and `pt-BR.ts`

## Tests

- [x] `api/src/services/__tests__/adminUserService.test.ts` (16)
- [x] `api/src/services/__tests__/adminStatsService.test.ts` (9)
- [x] `api/src/middleware/__tests__/adminAuth.test.ts` (5)
- [x] `api/src/routes/__tests__/adminUsers.test.ts` (7)
- [x] `api/src/routes/__tests__/adminStats.test.ts` (4)
- [x] `api/src/routes/__tests__/index.test.ts` — admin mount + 403 gating
- [x] `api/src/services/__tests__/authService.test.ts` — disabled-account login
      rejection, and `role` carried through
- [x] `app/src/pages/admin/__tests__/AdminUsersPage.test.tsx` (17)
- [x] `app/src/pages/admin/__tests__/AdminDashboardPage.test.tsx` (10)
- [x] `app/src/components/__tests__/Sidebar.test.tsx` — admin nav visibility

## Verification

- [x] `docker compose exec api npm test` — 73 files, 683 tests pass
- [x] `docker compose exec app npm test` — 88 files, 740 tests pass
- [x] `npm run build` green for both packages; lint clean for new files
- [x] Manual: admin sees the nav items and both pages; a non-admin sees neither
      and is redirected from `/admin/users` to `/daily`; the API answers a
      non-admin with 403 `FORBIDDEN`
- [x] Manual: disabling a user flips the row to Disabled, and that account's
      login is refused with the generic invalid-credentials message
      (`auth:login:failure` / `account-disabled` in the security log)
- [x] Manual: revoking a signed-in user's sessions makes their next API call
      401 `Session expired or revoked`
- [x] Manual: dashboard counts, pool/Redis health and session figures match the
      dev database

## Out of scope (unchanged from plan.md)

Self-serve role promotion, a persisted audit feed, and content moderation.
The first admin is still granted by hand:
`UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER('...');`
