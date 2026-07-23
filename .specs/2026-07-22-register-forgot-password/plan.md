# Register / Forgot Password / Reset Password — Plan

## Problem

`LoginPage` is the only auth screen. There's no way to create an account or
recover a lost password from the UI, even though most of the backend already
supports both (`POST /auth/register`, `POST /auth/reset-password`,
`POST /auth/reset-password/confirm`).

## Findings from research

- `POST /auth/register` only forwards `email`/`password` to `authService.register()`,
  which already accepts an optional `displayName` — the route just never wires it through.
- `POST /auth/reset-password` always returns a generic success message (anti-enumeration,
  intentional) but `sendPasswordResetEmail()` (`authService.ts:183-185`) is a no-op stub —
  no email provider is configured anywhere in the codebase. The raw reset token never
  reaches a real user today.
- Rate limiting (`rateLimitService.ts`) already computes `retryAfterSeconds` for
  register/login/reset-password, but the routes drop it before responding — the client
  only ever sees a static `RATE_LIMITED` message.
- `AuthContext.register()` (`AuthContext.tsx:62-67`) has a **pre-existing bug**: it sets
  `isAuthenticated: true` right after `apiRegister()` succeeds, but `/auth/register`
  never creates a session (no cookie — only `/login` does that via
  `buildCookieName`/`buildCookieOptions`). This is currently dead code since no Register
  page exists to trigger it. Fixed as part of this work by chaining register→login.
- `api/client.ts`'s `request()` throws a plain `Error` with only `message`, discarding
  `error.code`/`details`/`retryAfterSeconds` — needed to distinguish `EMAIL_IN_USE` vs
  `WEAK_PASSWORD` vs `RATE_LIMITED` etc. in the UI.
- `LoginPage.tsx` uses raw inline Tailwind classes; a newer `ui/Input`+`ui/Button`
  component pair (used in `StyleguidePage.tsx`) already implements the DESIGN.md
  input/error-state spec. New pages use the newer components; `LoginPage` gets
  restyled to match for visual consistency across all auth screens.

## Decisions

1. **Email provider: Resend.** Needs a verified sending domain
   (`planner.thiagobraga.dev` subdomain recommended, to isolate reputation from any
   other mail on the root domain) and an API key. User does account creation + DNS
   verification; this work wires up the code + secrets plumbing.
2. **Register gets a `displayName` field.** Route change to forward it;
   `authService.register()` already validates 1-50 chars.
3. **Register session creation: chain register→login client-side**, not a
   server-side session-creation path in `/auth/register`. Rationale: keeps a single
   source of truth for session creation (one rate limiter, one security-log call,
   one place that sets cookie flags/TTL) rather than two auth code paths that can
   drift out of sync over time.
4. **Rate-limit responses gain `retryAfterSeconds`** on register/login/reset-password
   429s, so the UI can show a real countdown instead of a generic message.
5. **Visual style: newer `ui/Input`/`ui/Button` components**, not LoginPage's current
   raw classes. LoginPage gets restyled to match (small, contained scope addition) so
   all three auth screens are visually consistent.

## Scope

**In scope:**
- `RegisterPage`, `ForgotPasswordPage` (request-only), `ResetPasswordPage` (confirm,
  reads `?token=` from URL)
- Real Resend email integration for password reset
- `displayName` on register
- `retryAfterSeconds` on rate-limit responses
- `ApiError` class in `client.ts` preserving `code`/`details`/`retryAfterSeconds`
- LoginPage restyle + cross-links between all four auth screens

**Out of scope:** email verification on signup, social login, 2FA, changing
password from within Settings (separate feature — this is only the
logged-out "I forgot my password" flow).

## Architecture

### Backend (`api/src/`)

- `routes/auth.ts`:
  - `/register`: destructure `displayName` from body, forward to `register()`.
  - `/register`, `/login`, `/reset-password`: on `RATE_LIMITED`, include
    `retryAfterSeconds` (already returned by the `checkXRate` calls) in the
    error response body.
- `services/emailService.ts` (new): wraps `resend` package.
  `sendPasswordResetEmail(email, resetLink)`. If `RESEND_API_KEY` isn't set
  (local dev), logs the link to console instead of calling Resend — lets the
  full flow be tested locally without real credentials.
- `services/authService.ts`: replace the `sendPasswordResetEmail` stub import
  with the real one from `emailService.ts`. Reset link =
  `${CORS_ORIGIN}/reset-password?token=${rawToken}` (reuses the existing
  `CORS_ORIGIN` env var as the app's public origin — no new config needed there).
- Config: `RESEND_API_KEY` (secret, file-based: `RESEND_API_KEY_FILE`, same
  pattern as `database_url` etc.), `EMAIL_FROM` (e.g. `noreply@planner.thiagobraga.dev`).
- `compose.prod.yml`: add `resend_api_key` secret, mount into `api` service.
  VPS: new `/etc/planner/secrets/resend_api_key`, owned by uid 1000 (matches
  the other node-consumed secrets — see production incident from tonight).

### Frontend (`app/src/`)

- `api/client.ts`:
  - `ApiError extends Error` with `code`, `details`, `retryAfterSeconds` fields.
    `request()` throws this instead of a plain `Error` (still `instanceof Error`,
    existing `catch` blocks that only read `.message` keep working unchanged).
  - `apiRegister(email, password, displayName)` — extend existing.
  - `apiRequestPasswordReset(email)` → `POST /auth/reset-password`.
  - `apiConfirmPasswordReset(token, newPassword)` → `POST /auth/reset-password/confirm`.
- `contexts/AuthContext.tsx`:
  - `register(email, password, displayName)`: `apiRegister(...)` then
    `login(email, password)` — establishes the real session via the existing,
    tested login path.
- New pages (using `components/ui/Input`, `components/ui/Button`):
  - `RegisterPage.tsx` — email, display name, password fields. Field-level
    errors from `VALIDATION_ERROR.details`; `EMAIL_IN_USE` → email field error;
    `RATE_LIMITED` → countdown from `retryAfterSeconds`.
  - `ForgotPasswordPage.tsx` — email only. Always renders the same generic
    success message after submit, matching the backend's anti-enumeration
    response (never reveals account existence either way).
  - `ResetPasswordPage.tsx` — reads `token` from `useSearchParams()`, one
    new-password field. `TOKEN_INVALID` → "link expired, request a new one"
    with a link to Forgot Password; `WEAK_PASSWORD` → field error; success →
    "password updated" + link to `/login`.
- `App.tsx`: add `/register`, `/forgot-password`, `/reset-password` as
  top-level routes, same `isAuthenticated ? <Navigate to="/daily"/> : <Page/>`
  guard pattern as `/login`.
- `LoginPage.tsx`: restyle inputs to `ui/Input`/`ui/Button`; add "Don't have an
  account? Register" and "Forgot password?" links.

## Testing

- Backend: unit tests for the `/register` displayName wiring, `retryAfterSeconds`
  in 429 bodies, `emailService.ts` (mock Resend client + dev-fallback console path).
- Frontend: page-level tests for all three new pages (success path, each error
  code's UI branch) following existing `LoginPage`-adjacent test patterns;
  `ApiError` unit test confirming `code`/`details`/`retryAfterSeconds` survive
  a non-OK response.
- Manual: full round trip against real Resend once domain is verified — send a
  reset email, click the link, set a new password, log in with it.

## Open follow-up (not blocking this work)

- Resend account creation + `planner.thiagobraga.dev` (or a subdomain) DNS
  verification is on the user — needed before the email actually sends in
  production. Code ships with the dev-console fallback either way, so this
  work isn't blocked on it.
