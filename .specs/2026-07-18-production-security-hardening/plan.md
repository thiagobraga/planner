# Production Security Hardening

**Status:** Ready for implementation  
**Priority:** Release blocker - do not expose Planner to public traffic until all P0 gates pass  
**Dependencies:** Complete or preserve the in-progress project-to-collection migration (`024_rename_projects_to_collections.sql`) before adding security migrations  
**Estimated scope:** 2 new migrations, 6-10 new security/deployment files, and changes across API auth, frontend auth/offline storage, Docker, and CI

## Outcome

Prepare Planner for a secure, single-user production launch using only email and password authentication. The production system must:

- never ship or seed a known credential;
- expose no public registration or stubbed password-recovery flow;
- use revocable, server-side opaque sessions rather than browser-readable JWTs;
- protect every state-changing authenticated request against CSRF;
- prevent offline data from crossing account boundaries;
- run immutable production images with no development server, bind mounts, admin UI, or fallback secrets;
- encrypt transport, persistent storage, and backups;
- ship with automated security checks, recovery evidence, and an incident runbook.

This plan intentionally does **not** add social login, require a user name, or implement zero-knowledge/end-to-end encryption.

## Current State and Release Blockers

### Development credentials and deployment paths

- `compose.yml:3-11` and `compose.yml:21-33` build the `development` targets, mount source directories, and provide weak database, Redis, and JWT fallbacks.
- `.docker/api/entrypoint.sh:4-15` installs packages and runs the development seed every time the API container starts.
- `api/src/db/seed.ts:7-10` provisions `dev@planner.local` with the fallback password `password123`.
- `app/src/pages/LoginPage.tsx:13-14` and `app/src/pages/LoginPage.tsx:97-100` expose that credential whenever Vite runs in development mode.
- `.docker/app/Dockerfile:13-18` uses `vite preview` as its production server; the checked-in `.docker/app/nginx.conf:6-19` is unused and points at API port `3000` instead of `4000`.
- `.env.example:1-5` contains usable-looking values instead of non-secret placeholders, while `compose.yml:30-33`, `compose.yml:63-65`, and `compose.yml:109-115` allow production to start with defaults.

### Authentication and session design

- `api/src/routes/auth.ts:16-42` sets an HttpOnly cookie but also returns the signed JWT in the JSON response.
- `api/src/services/authService.ts:116-121` creates a registration JWT without a server-side session, and `api/src/middleware/auth.ts:58-73` accepts tokens without a `sessionId` without revocation checks.
- `api/src/middleware/auth.ts:13-24` retains a Bearer-token fallback even though the browser client uses cookies.
- `api/src/services/syncService.ts:80-123` accepts cookie or handshake JWTs but never verifies that the associated database session still exists.
- `api/src/services/authService.ts:190-243` contains refresh logic, but `api/src/routes/auth.ts` exposes no refresh route and the frontend has no refresh flow.
- `api/src/db/migrations/003_sessions.sql:1-9` stores the session identifier directly in a column named `token_hash`.
- `api/src/services/authService.ts:32-49` requires only 12 characters and uses zxcvbn; `api/src/services/authService.ts:86` stores bcrypt hashes. Bcrypt cost 12 is an acceptable migration source, but new passwords should use Argon2id and a minimum of 15 characters for password-only authentication.
- `api/src/db/migrations/001_users.sql:5-7` requires a display name and only has a case-sensitive unique email constraint, despite the intended email-and-password-only product model.
- `api/src/services/authService.ts:281-283` has a no-op password-reset sender, so password recovery is not a working production feature.

### CSRF, browser storage, and response protection

- `api/src/middleware/csrf.ts:6-33` implements a naïve unsigned double-submit cookie and uses normal string comparison.
- `api/src/index.ts:76-93` mounts auth before CSRF and protects a hand-maintained list of route prefixes. New routes can be omitted; logout and `/api/v1/invitations/accept` are currently outside the protected prefixes.
- `app/src/utils/offlineQueue.ts:3-23` has one global IndexedDB store and queued records have no owner identifier.
- `app/src/hooks/useOfflineQueueReplay.ts:22-38` replays every queued mutation after any user authenticates.
- `app/src/contexts/AuthContext.tsx:66-73` clears React Query on logout but leaves IndexedDB mutations behind.
- `app/index.html:7` has a CSP meta tag, but production document headers are not configured. `frame-ancestors` cannot be enforced by a meta policy, and API Helmet headers do not protect the frontend HTML document.

### Existing strengths to preserve

- Parameterized PostgreSQL queries and user-scoped service APIs are already widespread.
- Cookies are already HttpOnly and SameSite Strict in `api/src/routes/auth.ts:8-14`.
- `api/src/index.ts:18-43` enables Helmet and global rate limiting.
- `api/src/middleware/errorHandler.ts:11-31` sanitizes unexpected error responses.
- `api/src/services/authService.ts:254-278` hashes password-reset tokens before storage.
- `.docker/api/Dockerfile:5-17` and `.docker/app/Dockerfile:5-18` already use non-root Node users.
- As of 2026-07-18, both package trees report zero npm audit findings, and the targeted auth, authorization, and offline-queue suites pass 27 tests.

## Security Principles

1. **Fail closed in production:** missing secrets, Redis, storage-encryption evidence, or migration failure must stop deployment.
2. **Minimize stored identity:** email is required; name and social identity are not.
3. **Keep credentials out of JavaScript:** only secure cookies carry session credentials.
4. **Make revocation authoritative:** REST and Socket.IO use the same database-backed session validator.
5. **Encrypt at the correct layer:** infrastructure encryption is mandatory; application-level field encryption requires an explicit threat-model decision.
6. **Prefer global controls:** authentication, CSRF, headers, rate limiting, and cache policy must not depend on remembering every new route.
7. **Prove recovery:** encrypted backups are incomplete until a restore has succeeded in an isolated environment.

## Architecture Decisions

### ADR-1: Encrypt infrastructure now; defer field-level content encryption

**Decision**

- Require HTTPS for browser traffic.
- Require an encrypted host volume or provider-managed encryption for PostgreSQL data.
- Encrypt every database backup with a key stored separately from the backup.
- Require certificate verification for remote PostgreSQL or Redis connections; a same-host deployment may instead use isolated Docker networks plus encrypted host storage, with the choice documented in the production runbook.
- Do not application-encrypt task titles, descriptions, habit names/notes, comments, collection names, or preferences in this implementation.
- Record a separate follow-up decision if the product must protect data from database operators, live database compromise, or a zero-knowledge service operator.

**Why**

Application-level content encryption would break or materially complicate the existing PostgreSQL full-text search (`api/src/db/migrations/009_tasks.sql:23-27`), filters, recurrence, reminders, collaboration, and server-side views. It also would not protect data from a compromised API process or same-origin XSS. Infrastructure encryption protects stolen disks, snapshots, and backups without those product regressions.

**Future trigger**

If the threat model later requires database-dump or operator resistance, create a separate spec for per-user data-encryption keys wrapped by KMS, authenticated encryption (AES-GCM), key versions, associated data, rotation, recovery, and blind indexes. Do not introduce ad hoc `pgcrypto` calls or store encryption keys beside ciphertext.

### ADR-2: Replace JWTs with opaque server-side sessions

**Decision**

- Generate 32 random bytes for each session and send the raw value only in a cookie.
- Store only `SHA-256(rawToken)` with the user ID, creation time, last-seen time, idle expiry, and absolute expiry.
- Use a 30-minute idle timeout and 12-hour absolute timeout as secure defaults, configurable only through validated production configuration.
- Use `__Host-planner_session` in production with `Secure; HttpOnly; SameSite=Strict; Path=/` and no `Domain` attribute. Use a separate non-`__Host-` cookie name only for explicit HTTP localhost development.
- Remove JWT issuance, JWT response fields, Bearer fallback, refresh-token code, and `jsonwebtoken` after migration.
- Use the same session lookup for REST and Socket.IO. Revocation or expiry must terminate both.

**Consequences**

Every authenticated request performs a session lookup, which the current middleware already effectively does for login-created sessions. PostgreSQL remains authoritative and logout becomes immediate. Add an index on `token_hash` and update `last_seen_at` at a bounded cadence rather than on every request.

### ADR-3: Launch as single-user, email-and-password only

**Decision**

- Default `PUBLIC_REGISTRATION_ENABLED=false` and do not render registration UI in production.
- Default `PASSWORD_RESET_ENABLED=false` until a real email provider and recovery tests exist.
- Add an operator-only provisioning command that reads the password from a protected file or hidden standard input, never a command-line argument, and never logs credentials.
- Make `display_name` nullable and remove it from the production registration contract/UI.
- Normalize email to lowercase NFC form and enforce a unique database index on `LOWER(email)`.
- Use Argon2id for all new hashes. On successful login, verify existing bcrypt hashes and transparently replace them with Argon2id.
- Require 15-128 Unicode characters, normalize NFC before hashing, allow spaces/paste/password managers, and reject a versioned local blocklist of common/compromised and Planner-specific passwords.
- Public signup, email verification, real password recovery, passkeys, and MFA require a follow-up authentication spec before multi-user launch.

**Superseded 2026-07-22 (`.specs/2026-07-22-register-forgot-password/`):** the
product direction changed to multi-user before this ADR's
`PUBLIC_REGISTRATION_ENABLED`/`PASSWORD_RESET_ENABLED` flags were ever
implemented — `/auth/register` and `/auth/reset-password*` ship unconditionally
enabled in production, with no toggle. This was a deliberate product decision
(confirmed 2026-07-23), not an accidental regression, but it retires this
ADR's "single-user, no public registration" launch gate. Real password
recovery and email verification were already delivered as part of that later
spec (Resend-backed reset email, domain-verified sending). Passkeys/MFA
remain a genuine follow-up. The P0 Go-Live item "no development email/password
or registration UI" (task.md:320) is retired by this decision, not failing.

### ADR-4: Serve one hardened same-origin application edge

**Decision**

- Build the Vite app in a Node build stage and serve only static `dist/` assets from an unprivileged Nginx production stage.
- Expose only the app/Nginx service to Traefik. Nginx proxies `/api/` and `/socket.io/` to API port `4000` on a private backend network.
- Keep PostgreSQL and Redis on a separate private data network reachable only by the API.
- Run migrations as an explicit one-shot deployment job before API rollout. Never seed in production.
- Use Docker secrets or mounted secret files; do not ship fallback passwords, URLs containing checked-in credentials, or usable values in example files.

## Implementation Plan

### Phase 0 - Security contract and configuration

#### [ADD] `docs/security/data-protection.md`

- Classify email, authentication data, task/habit/comment content, preferences, operational logs, and backups.
- State the ADR-1 encryption boundary and future field-encryption trigger.
- Define retention, deletion/export expectations, log redaction, and prohibited data in logs.

#### [ADD] `docs/production-runbook.md`

- Document the selected same-host or managed-data-store encryption profile.
- Record secret ownership/rotation, deployment, migration, backup, restore, rollback, session revocation, and incident procedures.
- Include a go-live evidence table with date, operator, command/result, and artifact location.

#### [MODIFY] `api/src/config.ts`

- Validate `NODE_ENV`, `DATABASE_URL` or `DATABASE_URL_FILE`, `REDIS_URL` or `REDIS_URL_FILE`, `CORS_ORIGIN`, `CSRF_SECRET` or `CSRF_SECRET_FILE`, and session TTLs.
- Reject placeholder/default secret values in production.
- Require production mode to fail when Redis is unavailable instead of silently disabling authentication throttling.
- Remove `JWT_SECRET` after the opaque-session migration.

### Phase 1 - User identity and password storage

#### [ADD] `api/src/db/migrations/025_users_auth_hardening.sql`

- Abort with a diagnostic query if case-insensitive duplicate emails exist.
- Normalize stored email values and add a unique index on `LOWER(email)`.
- Make `display_name` nullable.

#### [ADD] `api/src/services/passwordService.ts`

- Centralize NFC normalization, length validation, local password-blocklist checks, Argon2id hashing, bcrypt verification, and opportunistic bcrypt-to-Argon2id rehash.
- Configure Argon2id parameters through measured secure constants, not request input.

#### [ADD] `api/src/db/provisionUser.ts`

- Create or rotate the single production user without running development seeds.
- Read secrets from a protected file or hidden standard input and redact all output.
- Refuse to run without an explicit production provisioning flag and transactionally create the inbox/preferences records.

#### [MODIFY] `api/src/services/authService.ts`, `api/src/routes/auth.ts`, `app/src/pages/LoginPage.tsx`, `app/src/contexts/AuthContext.tsx`, `app/src/api/client.ts`

- Remove the display-name requirement from production authentication contracts.
- Disable register and reset routes/UI by default.
- Remove JWT fields from frontend and backend response types.
- Preserve generic invalid-credential and reset responses to avoid account enumeration.

### Phase 2 - Opaque sessions and shared REST/Socket.IO authorization

#### [ADD] `api/src/db/migrations/026_opaque_sessions.sql`

- Replace the misleading session token representation with a unique SHA-256 token hash.
- Add `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, and revocation metadata.
- Invalidate legacy JWT sessions during migration; this is an intentional one-time logout.

#### [ADD] `api/src/services/sessionService.ts`

- Create, hash, validate, touch, revoke, and expire opaque sessions.
- Use constant-time comparison where application comparisons are required.
- Return the authenticated user/session context used by both transports.

#### [MODIFY] `api/src/middleware/auth.ts`, `api/src/routes/auth.ts`, `api/src/services/syncService.ts`, `api/src/types/express.d.ts`, `app/src/utils/socket.ts`

- Accept credentials from the session cookie only.
- Use identical expiry/revocation rules for REST and Socket.IO.
- Revalidate Socket.IO sessions on a bounded interval and before client-originated events; disconnect after expiry/revocation and reject reconnects. Server-pushed sync events must not extend idle expiry.
- Clear the exact production cookie attributes on logout.
- Delete obsolete JWT/refresh code and remove `jsonwebtoken` from `api/package.json`.

### Phase 3 - Global CSRF, origin, cache, and document-header protection

#### [REPLACE] `api/src/middleware/csrf.ts`

- Implement a signed double-submit token bound to the authenticated session using HMAC-SHA-256 and a dedicated CSRF secret.
- Validate HMACs with `crypto.timingSafeEqual`.
- Require the token header on every unsafe authenticated `/api/v1` request, including logout and invitations.
- Add Origin and Fetch Metadata validation as defense in depth.

#### [MODIFY] `api/src/index.ts` and `api/src/routes/index.ts`

- Remove duplicate auth-router mounting.
- Apply JSON content-type validation, cache policy, origin checks, authentication, and CSRF from centralized middleware boundaries with explicit, documented public-route exemptions.
- Set an explicit request body size limit (`express.json({ limit: '100kb' })`) to prevent unauthenticated DOS via large payloads.
- Add `Strict-Transport-Security` (HSTS) to Helmet configuration or the reverse-proxy layer.
- Add a global middleware that rejects non-JSON `Content-Type` on API mutation routes to prevent body-parsing bypass.
- Ensure future unsafe routes are protected automatically.
- Configure proxy trust only for the known production proxy path.

#### [MODIFY] `app/src/api/client.ts`

- Continue sending credentials and the signed CSRF token header.
- Never expose or store a session credential in JavaScript.
- On `401`, clear authenticated state without replay loops; do not silently retry unsafe requests.

#### [MODIFY] `.docker/app/nginx.conf` and `app/index.html`

- Serve CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `frame-ancestors 'none'` as response headers.
- Remove the CSP meta tag after the header is active.
- Cache hashed static assets immutably, revalidate `index.html`, and never cache `/api/` responses.
- Preserve WebSocket upgrade handling to API port `4000`.

### Phase 4 - Offline and shared-device isolation

#### [MODIFY] `app/src/utils/offlineQueue.ts`

- Upgrade IndexedDB to a new version and add `ownerUserId` to every record and index.
- Delete unowned legacy queue records during migration; do not guess ownership.
- Require an authenticated owner for enqueue, list, replay, remap, and removal operations.
- Add `clearQueuedMutations(ownerUserId)` and a safe full-clear path for compromised sessions.

#### [MODIFY] `app/src/hooks/useOfflineQueueReplay.ts`, `app/src/contexts/AuthContext.tsx`, `app/src/api/client.ts`

- Replay only the current user's records.
- Clear that user's queue before completing logout, even if the network logout request fails.
- Fail closed rather than enqueue an unsafe request when no authenticated owner is available.
- Ensure account switching cannot expose or replay another user's request body.

#### [MODIFY] `app/vite.config.ts`

- Explicitly exclude `/api/` and `/socket.io/` from service-worker runtime caching.
- Continue precaching only public application-shell assets.

### Phase 5 - Production images, secrets, networks, and encrypted persistence

#### [MODIFY] `.docker/api/Dockerfile`, `.docker/app/Dockerfile`, `.docker/app/nginx.conf`

- Use reproducible `npm ci` builds and a minimal production runtime containing no source bind mount or development server.
- Keep non-root users, add health checks, and ensure runtime images contain only required production artifacts.
- Serve the frontend with unprivileged Nginx, not `vite` or `vite preview`.

#### [ADD] `compose.prod.yml`

- Select only production targets and set `NODE_ENV=production`.
- Expose only the frontend edge to Traefik.
- Separate edge, backend, and data networks.
- Add `read_only`, `tmpfs`, `cap_drop: [ALL]`, `no-new-privileges`, resource limits, health checks, and restart policies where compatible.
- Consume Docker secrets/mounted secret files with no fallback values.
- Add a one-shot migration service and no seed or pgAdmin service.
- Keep PostgreSQL and Redis ports unpublished.

#### [MODIFY] `.env.example`, `.gitignore`, `.dockerignore`

- Replace usable values with obvious non-secret placeholders.
- Include every production secret filename and local backup artifact in ignore rules.
- Verify that build contexts cannot include `.env`, backups, logs, or private keys.

#### Operational encryption gate

- Verify the PostgreSQL volume is on encrypted storage before first write.
- Require `verify-full` TLS and a trusted CA for remote PostgreSQL/Redis; document the isolated same-host exception if selected.
- Produce an encrypted backup, restore it into an isolated database, and verify counts plus login/task/habit reads.
- Store backup encryption keys separately from backup objects and document rotation/revocation.

### Phase 6 - Automated verification and operations

#### [ADD] `.github/workflows/ci.yml`, `.github/workflows/security.yml`, `.github/dependabot.yml`

- Run clean installs, type checks/builds, lint, and tests for both packages.
- Run production dependency audit, secret scanning, CodeQL/static analysis, Docker build checks, container vulnerability scanning, and SBOM generation.
- Pin third-party workflow actions to immutable commit SHAs.
- Block merge/deployment on high or critical production findings unless a dated, reviewed exception exists.

#### [ADD] API security tests

- Add session lifecycle, cookie attributes, no-token-response, CSRF coverage, origin checks, rate limiting, password migration, normalized email uniqueness, disabled route, cache header, and Socket.IO revocation tests.
- Extend authorization property tests to every route family, including the habit-group and collection routes.

#### [ADD] Frontend security tests

- Add logout queue clearing, user-partitioned replay, legacy IndexedDB migration, unauthenticated enqueue rejection, and auth-response tests.

#### Observability and incident readiness

- Log authentication success/failure, rate-limit activation, session revocation, provisioning, migration, backup, and restore events without email, password, token, task, or habit content.
- Add request IDs to all API responses and logs.
- Alert on repeated authentication failures, unexpected registration/reset attempts, Redis unavailability, migration failure, and backup/restore failure.
- Document the owner and process for security incident assessment and any required ANPD/user notification.

## Acceptance Criteria

### P0 - Mandatory before any public traffic

- [ ] `docker compose -f compose.prod.yml config` fails when any required secret is missing and contains no default credential.
- [ ] Production containers use no bind-mounted source, Vite dev server, `vite preview`, seed script, or pgAdmin service.
- [ ] The production bundle and rendered login page contain neither `dev@planner.local` nor `password123`.
- [ ] Public registration and password-reset request/confirm endpoints are disabled by default and return a non-enumerating response.
- [ ] The single production account can be provisioned without putting its password in process arguments, logs, Git, shell history, or image layers.
- [ ] New password hashes are Argon2id; a successful bcrypt login atomically upgrades the hash.
- [ ] Passwords shorter than 15 characters, longer than 128 characters, or on the local blocklist are rejected; spaces, Unicode, paste, and password-manager autofill remain supported.
- [ ] Case variants of the same email cannot create two users, and no API requires a display name.
- [ ] Login/register responses contain no access token, refresh token, JWT, or opaque session token.
- [ ] Production session cookies are `__Host-` prefixed and include `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`, with no `Domain`.
- [ ] Logout, idle expiry, absolute expiry, password rotation, and explicit revocation immediately invalidate REST and Socket.IO access.
- [ ] Authorization headers and Socket.IO handshake auth tokens are rejected.
- [ ] Every unsafe authenticated API route rejects a missing, invalid, or session-mismatched CSRF token with `403`, including logout and invitation acceptance.
- [ ] Cross-site Origin/Fetch Metadata requests are rejected, and public auth endpoints accept only the intended JSON request shape.
- [ ] Authenticated API responses include `Cache-Control: private, no-store`.
- [ ] Frontend document responses include CSP, HSTS, clickjacking, MIME-sniffing, referrer, and permissions policies as HTTP headers.
- [ ] IndexedDB records are owned by a user, legacy unowned records are removed, logout clears the current user's queue, and one account can never replay another account's mutation.
- [ ] Only the frontend edge is externally routable; API, PostgreSQL, and Redis are restricted to their required private networks.
- [ ] PostgreSQL storage and backup artifacts are encrypted, and a production-format backup has been restored successfully in isolation.
- [ ] API and app tests/builds pass from clean installs, security workflows pass, and no high/critical production dependency or image finding is open without an approved exception.

### P1 - Required before enabling public multi-user signup

- [ ] Email ownership verification is implemented and tested.
- [ ] Password recovery uses a real delivery provider, single-use hashed tokens, expiry, rate limiting, session revocation, and end-to-end tests.
- [ ] Privacy notice, retention, account export/deletion, abuse controls, and incident contacts are published.
- [ ] Passkeys/WebAuthn and recovery codes have a separate approved design; social login remains optional.

## Verification Matrix

### Unit

- Password normalization, blocklist, Argon2id hash/verify, and bcrypt migration.
- Opaque token generation/hash, idle/absolute expiry, revocation, and cookie option builders.
- CSRF HMAC creation/session binding/timing-safe verification.
- Email normalization and configuration rejection.
- IndexedDB owner filtering, clearing, remapping, and legacy migration.

### Integration

- Login -> authenticated REST -> Socket.IO -> logout -> both transports rejected.
- Password rotation revokes every existing session.
- All unsafe route families fail without valid CSRF and pass with a valid same-session token.
- Redis outage prevents production authentication/startup according to fail-closed policy.
- Account A queues offline work, logs out, Account B logs in, and no Account A data is visible or replayed.
- Migration from the current user/session schema preserves users, upgrades email constraints, and intentionally invalidates legacy sessions.

### End to end

- Build and launch `compose.prod.yml` behind TLS with injected secrets.
- Verify security headers and cookie attributes using `curl` plus browser DevTools.
- Confirm known development credentials cannot authenticate and do not exist in production artifacts.
- Provision the single account, create a task and habit, reconnect Socket.IO, log out, and confirm protected data is inaccessible.
- Create an encrypted backup, destroy the isolated test database, restore it, and repeat the task/habit read smoke test.

### Observability

- Trigger failed login, rate limit, invalid CSRF, revoked session, Redis failure, migration failure, and backup failure alerts in staging.
- Inspect logs and confirm they contain request/event metadata but no email, password, session/CSRF token, task title/description, habit name/note, or comment body.

## Risks and Mitigations

- **Session migration logs out all users:** expected before launch; announce and verify the one-time invalidation in staging.
- **Argon2 resource exhaustion:** benchmark chosen parameters on the production CPU/memory limit and combine with durable IP/account throttling.
- **CSRF middleware breaks public auth flows:** keep a minimal explicit exemption list and cover every exemption with Origin/content-type/rate-limit tests.
- **IndexedDB migration discards pending legacy work:** deletion is intentional because ownership cannot be proven; surface a one-time warning in development/staging before release.
- **Docker hardening prevents runtime writes:** enumerate only required writable paths and mount them as bounded `tmpfs` volumes.
- **Proxy/IP misconfiguration defeats rate limits:** API must be unreachable directly and proxy trust must match exactly one verified Traefik hop.
- **Backup encryption creates unrecoverable data:** escrow and rotate keys separately, then make restore success—not backup creation—the release gate.
- **Field encryption deferred while users enter sensitive content:** state the storage/operator threat model in product documentation and open the envelope-encryption follow-up before marketing Planner as zero-knowledge or suitable for regulated health data.
- **Existing feature work overlaps migrations, route indexes, and service names:** preserve the in-progress collection rename and current habit-group routes, allocate security migrations after `024`, and rely on global middleware so renamed/new route families inherit controls automatically.

## References

- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- NIST SP 800-63B: https://pages.nist.gov/800-63-4/sp800-63b.html
- PostgreSQL encryption options: https://www.postgresql.org/docs/current/encryption-options.html
- Vite static deployment: https://vite.dev/guide/static-deploy
- ANPD incident regulation overview: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca
