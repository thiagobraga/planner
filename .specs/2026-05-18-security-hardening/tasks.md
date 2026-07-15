# Security Hardening

## Context

Pre-launch security audit (2026-05-18) of api/, app/, and infra found 3 CRITICAL, 7 HIGH, 6 MEDIUM issues. Scope: fix Critical+High+Medium now. Migrate auth tokens to httpOnly cookies + CSRF. Pipeline/CI tooling deferred to a follow-up spec ("after fixes").

Goal: ship a hardened baseline before exposing the app publicly, then layer CI/automation on top in a separate spec.

---

## Phase 1 - CRITICAL (block deploy)

- [x] **Remove `.env` from git history**
  - `git rm --cached .env`, verify `.gitignore` covers it, force rotate any leaked secrets
  - Regenerate `POSTGRES_PASSWORD` + `JWT_SECRET`
- [x] **Fail-fast on missing `JWT_SECRET`**
  - Files: `api/src/index.ts:17`, `api/src/middleware/auth.ts:5`, `api/src/services/authService.ts:10`, `api/src/services/syncService.ts:7`
  - Replace `process.env.JWT_SECRET ?? "dev-secret-change-me"` with a single `config.ts` export that throws on missing in non-test env
  - Also validate `DATABASE_URL` and `CORS_ORIGIN` at boot (`api/src/db/pool.ts:4`)
- [x] **Remove plaintext password reset token logging**
  - `api/src/services/authService.ts:213` - delete `console.log("[PASSWORD RESET] Token for ...")`
  - Stub `sendPasswordResetEmail(email, rawToken)` (no-op for now) so the call site stays explicit
- [x] **Remove seed credential logging**
  - `api/src/db/seed.ts:48` - drop `console.log("Seeded user: ... with password: ...")`
  - Read seed password from env var, do not hardcode

## Phase 2 - HIGH (auth + transport)

- [x] **Migrate JWT to httpOnly cookie + CSRF**
  - Backend: on `/auth/login` and `/auth/register`, set `Set-Cookie: planner_session=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/`
  - Add `cookie-parser`; read token from cookie in `api/src/middleware/auth.ts` (fallback to `Authorization: Bearer` only behind a flag for socket.io handshake)
  - Add CSRF: double-submit cookie. Issue `XSRF-TOKEN` (readable) + require `X-XSRF-TOKEN` header on all non-GET routes. Lib: `csrf-csrf` (modern) or hand-roll
  - Frontend: remove `localStorage.getItem/setItem('planner_token')` from `app/src/api/client.ts:4,8,12`; add `credentials: 'include'` to fetch; read `XSRF-TOKEN` cookie, send `X-XSRF-TOKEN` header
  - Socket.io: switch `auth: { token }` (`app/src/utils/socket.ts:22-26`) to cookie-based; verify on server in `api/src/services/syncService.ts:79-101`
  - Update `app/src/contexts/AuthContext` logout to call `/auth/logout` (server clears cookie) + `qc.clear()`
- [x] **Install + configure `helmet`**
  - `api/src/index.ts` - `app.use(helmet())`, enable HSTS in prod
- [x] **Restrictive CORS**
  - `api/src/index.ts:16-25` + `api/src/services/syncService.ts:72-77` - remove `"*"` default; require `CORS_ORIGIN` env; set `credentials: true`
- [x] **Content Security Policy**
  - `app/index.html` - add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'">`
  - Tighten `'unsafe-inline'` once styles audited
- [x] **Global rate limiting**
  - `express-rate-limit` in `api/src/index.ts` - global 100 req/min/IP
  - Per-route stricter limits: `/auth/register` (5/hr/IP), `/auth/password-reset` (3/hr/email), comments (30/min/user)
  - Keep existing redis-backed login limiter in `api/src/services/authService.ts:113-123`; add account lockout after 10 failures/24h
- [x] **Sanitize error responses**
  - `api/src/middleware/errorHandler.ts:21` - never return stack/SQL detail to client; log full error server-side only; return `{ error: "Internal error", requestId }`
- [x] **Remove dev credentials from LoginPage**
  - `app/src/pages/LoginPage.tsx:11-12,147` - gate behind `import.meta.env.DEV`, never ship in prod bundle

## Phase 3 - MEDIUM (defense-in-depth)

- [x] **Shorten JWT expiry + add refresh**
  - `api/src/services/authService.ts:11` - set `JWT_EXPIRATION_SECONDS = 3600` (1h)
  - Add refresh-token rotation tied to `sessions` table; refresh endpoint reads refresh cookie, issues new session JWT
- [x] **Comment HTML sanitization**
  - `api/src/services/commentService.ts:77-86` - `sanitize-html` with allowlist before persist
  - Document frontend escaping requirement
- [x] **Validate socket event payload scope**
  - `api/src/services/syncService.ts:115-119` - assert payload `projectId` matches `socket.data.userId` accessible projects on every event, not just subscribe
- [x] **Password strength**
  - `api/src/services/authService.ts:227-250` - add `zxcvbn`, require score ≥ 3; min length 12
- [x] **Redis auth**
  - `compose.yml` - `command: redis-server --requirepass ${REDIS_PASSWORD}`; pass through `REDIS_URL`
- [x] **Non-root containers**
  - `.docker/api/Dockerfile`, `.docker/app/Dockerfile` - add `app` user (uid 1000), `USER app` before CMD
- [~] **Schema-validate localStorage reads** (TodayPage was renamed to DailyPage; no localStorage reads found — N/A)
  - `app/src/pages/TodayPage.tsx:75` - Zod schema for `DaySection[]` before use
- [x] **Gate frontend console.log on DEV**
  - `app/src/utils/socket.ts:13-16`, `app/src/components/AppShell.tsx:138` - wrap in `if (import.meta.env.DEV)`

---

## Files to modify (critical paths)

```
api/src/index.ts                         # helmet, CORS, rate limit, cookie-parser, csrf
api/src/middleware/auth.ts               # cookie token read
api/src/middleware/errorHandler.ts       # sanitize errors
api/src/services/authService.ts          # cookie set/clear, refresh, zxcvbn, remove logs
api/src/services/syncService.ts          # CORS, payload scope checks
api/src/services/commentService.ts       # sanitize-html
api/src/services/taskService.ts          # (review only)
api/src/db/seed.ts                       # remove cred log
api/src/db/pool.ts                       # validate DATABASE_URL
api/src/config.ts                        # NEW - central env validation
.docker/api/Dockerfile                   # non-root user
.docker/app/Dockerfile                   # non-root user
compose.yml                              # redis password, secret env
.env / .env.example                      # rotate, scrub
.gitignore                               # verify .env

app/src/api/client.ts                    # cookie auth, drop localStorage, CSRF header
app/src/contexts/AuthContext.*           # logout calls server, clears cache
app/src/utils/socket.ts                  # cookie auth, DEV-gate logs
app/src/pages/LoginPage.tsx              # DEV-gate dev creds
app/src/pages/TodayPage.tsx              # Zod parse localStorage
app/index.html                           # CSP meta
```

## New deps

- api: `helmet`, `cookie-parser`, `csrf-csrf`, `express-rate-limit`, `sanitize-html`, `zxcvbn`
- app: `zod` (likely already present - verify)

---

## Verification

End-to-end checks after each phase:

**Phase 1**

- `git ls-files | grep '\.env$'` returns empty
- `unset JWT_SECRET && pnpm --filter api dev` exits non-zero with clear error
- `grep -r "PASSWORD RESET\] Token" api/src` returns empty
- Trigger password reset, confirm no token in `docker logs api`

**Phase 2**

- Login → DevTools → Application → Cookies shows `planner_session` HttpOnly+Secure+SameSite=Strict
- DevTools → localStorage has no `planner_token` key
- `curl -X POST http://localhost:4040/api/tasks` without CSRF header → 403
- Response headers include `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`
- 6 rapid login attempts → 429
- Trigger backend exception → response body has no stack trace, server log has full trace
- Login page in `pnpm build` preview: no "dev@planner.local" visible

**Phase 3**

- Login, wait 61 min → next request returns 401 + refresh flow issues new cookie
- Post comment with `<script>alert(1)</script>` → stored as escaped text, renders inert
- Socket emit `task:update` with foreign projectId → server rejects
- Register with `password` → rejected by zxcvbn
- `docker exec planner-redis redis-cli ping` requires `-a $REDIS_PASSWORD`
- `docker exec planner-api whoami` returns `app` not `root`

Full regression: existing test suites pass (`pnpm --filter api test`, `pnpm --filter app test`), manual smoke of login → create task → sync across tabs.

---

## Out of scope (next spec)

Pipeline / automation - to be planned separately:

- GitHub Actions CI (npm audit, eslint, vitest, secret scan)
- Husky pre-commit (block .env, lint-staged, eslint-plugin-security)
- Dependabot / Renovate
- SBOM / supply-chain scanning
