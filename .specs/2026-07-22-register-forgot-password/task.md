# Register / Forgot Password / Reset Password — Tasks

Markers: `[ ]` not started · `[~]` in progress · `[x]` done

Ordering rationale: backend contract first (1–4), then the frontend client layer
that consumes it (5–6), then pages (7–10), then infra/docs (11–12). Each phase
leaves the tree green — run the phase's tests before moving on.

---

## Phase 1 — Backend: auth route contract

### 1. `displayName` on `POST /auth/register`

- [x] `api/src/routes/auth.ts:27` — destructure `displayName` from `req.body`
      and pass it into `register({ email, password, displayName })`.
      `authService.register()` already accepts + validates it
      (`authService.ts:49-53`, 1–50 chars) — route is the only missing link.
- [x] `api/src/routes/__tests__/auth.test.ts` — assert `mockRegister` is called
      with `{ email, password, displayName }` when the body carries one, and
      with `displayName: undefined` when it doesn't.

### 2. `retryAfterSeconds` in 429 bodies

- [x] `api/src/routes/auth.ts` — three call sites return a bare
      `{ error: { code: "RATE_LIMITED", message } }` and drop the
      `retryAfterSeconds` that `checkXRate()` already computed:
  - `/register` (`auth.ts:21-24`) — `rateResult.retryAfterSeconds` = 3600
  - `/login` (`auth.ts:55-58`) — = 900
  - `/reset-password` (`auth.ts:87-90`) — = 3600

      Add `retryAfterSeconds` to the error object. Keep the shape
      `{ error: { code, message, retryAfterSeconds } }` so it stays compatible
      with the documented `{ error: { code, message, details? } }` envelope.
- [x] Also set the standard `Retry-After` header (seconds) on those responses —
      free correctness win for any non-browser client.
- [x] `auth.test.ts` — one test per endpoint: mock `checkXRate` to return
      `{ allowed: false, retryAfterSeconds: N }`, assert status 429 and
      `body.error.retryAfterSeconds === N`.

### 3. Fix dead registration rate limit (found during research, not in plan.md)

- [x] `rateLimitService.ts:200` exports `incrementRegistrationAttempts(ip)` but
      **nothing calls it**. `/register` checks the counter and never increments
      it, so `checkRegistrationRate()` always reads 0 and the 3-per-hour cap
      never fires. `/reset-password` does this correctly
      (`auth.ts:95`) — mirror that: call
      `await incrementRegistrationAttempts(req.ip ?? "unknown")` in `/register`
      after a successful `register()`.
- [x] Decide + document: increment only on success (chosen — a failed
      registration attempt from a legit typo shouldn't burn the quota, and
      `EMAIL_IN_USE` enumeration is already blunted by the 3/hour cap on
      successes). Keep the `securityLog.authRegisterFailure` path unchanged.
- [x] `auth.test.ts` — assert `incrementRegistrationAttempts` called once on
      201, not called when `register()` throws.

### 4. Registration returns 201 with no session — confirm, don't change

- [x] No code change. Documenting the decision (plan.md §Decisions 3): session
      creation stays exclusively in `/auth/login`. The frontend chains
      register → login (task 6). Note it in the route as a one-line WHY comment
      so the next reader doesn't "fix" it by adding a second session path.

---

## Phase 2 — Backend: email

### 5. `emailService.ts`

- [x] `npm i resend` in `api/` (not currently a dependency — verified against
      `api/package.json`).
- [x] New `api/src/services/emailService.ts`:
  - `sendPasswordResetEmail(email: string, resetLink: string): Promise<void>`
  - If `RESEND_API_KEY` is unset → `console.info` the link and return.
    Lets the whole flow be exercised locally with no credentials.
  - If set → `resend.emails.send({ from: EMAIL_FROM, to: email, subject, html, text })`.
  - Never throw into the caller: a send failure must not turn
    `POST /auth/reset-password` into an error response, because a non-generic
    response reintroduces the account-enumeration leak the generic message
    exists to prevent. Catch, `console.error`, return.
  - Plain-text alternative alongside the HTML body (deliverability; many
    spam filters penalize HTML-only mail).
- [x] `api/src/config.ts` — add:
  - `RESEND_API_KEY` via `readSecret("RESEND_API_KEY", "")` (empty fallback =
    dev console mode; supports `RESEND_API_KEY_FILE` for free via `readSecret`).
  - `EMAIL_FROM` via `readSecret("EMAIL_FROM", "noreply@planner.thiagobraga.dev")`.
  - In production, if `RESEND_API_KEY` is empty, `console.warn` at startup that
    password reset emails will not be delivered. Warn, don't throw — a missing
    email key should not take the whole API down.
- [x] `api/src/services/__tests__/emailService.test.ts` — mock the `resend`
      module. Cover: dev fallback logs and skips the client; configured path
      calls `emails.send` with the right `from`/`to`/link; a rejecting client
      is swallowed (no throw).

### 6. Wire the real sender into `authService`

- [x] `authService.ts:183-185` — delete the `sendPasswordResetEmail` no-op stub
      (no back-compat shim; delete cleanly) and import the real one from
      `emailService.js`.
- [x] `authService.ts:178` — build the link as
      `${CORS_ORIGIN}/reset-password?token=${rawToken}` and `await` the send.
      Import `CORS_ORIGIN` from `../config.js` — it is the app's public origin,
      no new env var needed.
- [x] `api/src/services/__tests__/authService.test.ts` — assert the mocked
      sender receives a link containing the raw token, and that an unknown
      email still returns the same generic message without sending anything.

---

## Phase 3 — Frontend: client layer

### 7. `ApiError` in `api/client.ts`

- [ ] `app/src/api/client.ts:122-125` — `request()` currently throws
      `new Error(body?.error?.message)`, discarding `code`, `details`, and
      `retryAfterSeconds`.
- [ ] Add and export `class ApiError extends Error` with
      `code: string`, `status: number`, `details?: unknown`,
      `retryAfterSeconds?: number`. Throw it from the `!res.ok` branch.
      Still `instanceof Error` with a populated `.message`, so every existing
      `catch (err) { err instanceof Error ? err.message : ... }` site keeps
      working untouched — no call-site migration needed.
- [ ] `apiRegister(email, password, displayName?)` — add the third arg, include
      it in the body only when provided.
- [ ] `apiRequestPasswordReset(email)` → `POST /auth/reset-password`.
- [ ] `apiConfirmPasswordReset(token, newPassword)` → `POST /auth/reset-password/confirm`.
- [ ] `app/src/api/__tests__/client.test.ts` — a non-OK response with a full
      error envelope yields an `ApiError` carrying `code` / `details` /
      `retryAfterSeconds` / `status`; a body with no parseable JSON still
      yields `HTTP <status>` as the message.

### 8. `AuthContext.register` — fix the pre-existing bug

- [ ] `AuthContext.tsx:62-67` sets `isAuthenticated: true` after `apiRegister()`,
      but `/auth/register` never sets a session cookie — the user would land in
      the app with no session and get bounced on the first API call. Dead code
      today (no Register page exists); live the moment task 10 ships.
- [ ] Change to: `await apiRegister(email, password, displayName)` then
      `await login(email, password)` — reuses the one tested code path that
      creates a session. Widen the signature to
      `register: (email, password, displayName?) => Promise<void>` in
      `AuthContextValue`.
- [ ] `app/src/contexts/__tests__/AuthContext.test.tsx` — register calls
      `apiRegister` then `apiLogin`; auth state only flips after the login
      resolves; a failing `apiRegister` leaves `isAuthenticated` false.

---

## Phase 4 — Frontend: pages

Shared: all four auth screens use `components/ui/Input` + `components/ui/Button`
(`variant="primary" size="lg"`), the same centered `max-w-80` shell as
`LoginPage`, and 24px-multiple spacing per DESIGN.md.

### 9. Extract the shared auth shell

- [ ] `app/src/components/AuthShell.tsx` — the icon + "Planner" +
      "Bulletjournal online" header and the centered layout wrapper, lifted
      verbatim out of `LoginPage.tsx:5-44`. Four screens repeating it is the
      point at which extraction pays for itself.
- [ ] Props: `children`, optional `title` / `subtitle` override.

### 10. `RegisterPage.tsx`

- [ ] Fields: email (`autoComplete="username"`), display name
      (`autoComplete="name"`, optional), password
      (`autoComplete="new-password"`).
- [ ] Submit → `register(email, password, displayName || undefined)` →
      `navigate('/daily', { replace: true })`.
- [ ] Error branches off `ApiError.code`:
  - `VALIDATION_ERROR` → map `details` (array of `{ field, message }`, see
    `utils/validate.ts`) onto the matching field's `errorText`
  - `EMAIL_IN_USE` → error on the email field
  - `RATE_LIMITED` → form-level message with a live countdown from
    `retryAfterSeconds`; disable submit until it hits zero
  - anything else → generic form-level message
- [ ] Link: "Already have an account? Sign in" → `/login`.
- [ ] `app/src/pages/__tests__/RegisterPage.test.tsx` — render, success path,
      one test per error branch, countdown renders and re-enables submit
      (fake timers).

### 11. `ForgotPasswordPage.tsx`

- [ ] Single email field → `apiRequestPasswordReset(email)`.
- [ ] On success **and on any non-rate-limit error**, render the same generic
      confirmation ("If an account exists, a reset email has been sent"). The
      backend deliberately never reveals whether the account exists
      (`authService.ts:159`); the UI must not leak it either by branching
      differently. `RATE_LIMITED` is the one exception — that reveals nothing
      about the account, only about the IP, so show the countdown.
- [ ] Links: back to `/login`.
- [ ] `__tests__/ForgotPasswordPage.test.tsx` — success and server-error both
      produce the identical confirmation text; `RATE_LIMITED` shows a countdown.

### 12. `ResetPasswordPage.tsx`

- [ ] Read `token` from `useSearchParams()`. No token in the URL → render the
      "link is invalid" state immediately, without a submittable form.
- [ ] One new-password field (`autoComplete="new-password"`) →
      `apiConfirmPasswordReset(token, newPassword)`.
- [ ] Error branches:
  - `TOKEN_INVALID` → "This link has expired or has already been used" +
    link to `/forgot-password`
  - `VALIDATION_ERROR` / weak password → field-level error text
- [ ] Success → confirmation + link to `/login`. Do **not** auto-login: the
      confirm endpoint deletes every session for that user
      (`authService.ts:239`), which is the correct security behavior, so the
      user must sign in fresh.
- [ ] `__tests__/ResetPasswordPage.test.tsx` — missing token, success,
      `TOKEN_INVALID`, weak password.

### 13. `LoginPage` restyle + cross-links

- [ ] Swap the raw `inputClassName` inputs (`LoginPage.tsx:31`, 47-65) and the
      hand-rolled button (71-77) for `ui/Input` / `ui/Button`; wrap in
      `AuthShell`.
- [ ] Add "Forgot password?" → `/forgot-password` and "Don't have an account?
      Register" → `/register`.
- [ ] Surface `RATE_LIMITED` countdown here too, now that the 429 carries
      `retryAfterSeconds`.
- [ ] Update `app/src/pages/__tests__/LoginPage.test.tsx` — it queries by
      `getByPlaceholderText('Email' | 'Password')`, which still works if the
      placeholders are preserved; verify and adjust the button query if the
      accessible name changes.

### 14. Routes

- [ ] `app/src/App.tsx:23` — add `/register`, `/forgot-password`,
      `/reset-password` beside `/login`, each with the same
      `isAuthenticated ? <Navigate to="/daily" replace /> : <Page />` guard.

---

## Phase 5 — Infra & docs

### 15. Secrets plumbing

- [ ] `.env.example` — document `RESEND_API_KEY` and `EMAIL_FROM` (commented,
      with a note that leaving the key empty logs reset links to the API
      console instead of sending mail).
- [ ] `compose.prod.yml` — add a `resend_api_key` secret
      (`file: ${RESEND_API_KEY_FILE:-./secrets/resend_api_key}`), mount it on
      the `api` service, and set `RESEND_API_KEY_FILE: /run/secrets/resend_api_key`
      + `EMAIL_FROM` in that service's `environment` — same shape as
      `csrf_secret` (`compose.prod.yml:47,156`).
- [ ] VPS: create `/etc/planner/secrets/resend_api_key`, `chown 1000:1000`,
      `chmod 400`. Ownership matters — a root-owned secret is unreadable by the
      non-root node user and produced tonight's production incident.
- [ ] `compose.yml` (dev) — pass `RESEND_API_KEY`/`EMAIL_FROM` through from
      `.env` if set; absent is the supported default.

### 16. Docs

- [ ] `CLAUDE.md` — add `services/emailService.ts` to the backend service list;
      note the new auth routes in the Pages & Routes table.
- [ ] `.specs/2026-07-22-register-forgot-password/plan.md` — append the
      registration-rate-limit bug (task 3) to "Findings from research"; it was
      discovered after the plan was written.

---

## Phase 6 — Verification

- [ ] `docker compose exec api npm run lint && docker compose exec api npm test`
- [ ] `docker compose exec app npm run lint && docker compose exec app npm test`
- [ ] `docker compose exec api npm run build && docker compose exec app npm run build`
- [ ] Manual, dev (no Resend key): register a new account → lands logged in on
      `/daily`; request a reset → link appears in `docker compose logs api`;
      open it → set a new password → confirm the old password is rejected and
      the new one works.
- [ ] Manual, production (blocked on the user's Resend account + DNS
      verification, see plan.md "Open follow-up"): same round trip against a
      real inbox. Everything else ships without it.

---

## Not doing (from plan.md "Out of scope")

Email verification on signup · social login · 2FA · changing password from
Settings while logged in.
