# Privacy, Cookies & Legal Basis — Plan

## Context

Planner currently has **no privacy policy, cookie policy, or terms of service page**. These are prerequisites for:
- Launching Google OAuth login (Feature 2) — Google requires a privacy policy URL on the OAuth consent screen
- GDPR compliance (EU users) — privacy policy is a legal requirement
- LGPD compliance (Brazilian users) — privacy policy is a legal requirement
- Building user trust in a production application

This spec covers creating the legal pages, implementing cookie consent where needed, and documenting the data processing legal basis.

---

## Pages to Create

### 1. Privacy Policy (`/privacy`)

Public page (no auth required). Must cover:

#### Data We Collect

| Data Category | Source | Purpose | Legal Basis (GDPR) | Legal Basis (LGPD) |
|---|---|---|---|---|
| Email address | Registration / Google OAuth | Account identification, login | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Display name | Registration / Google OAuth | Personalization | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Password hash | Registration | Authentication | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Google user ID | Google OAuth | Account linking | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Tasks, notes, events | User input | Core service functionality | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Collections, labels | User input | Organization features | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Habits, completions | User input | Habit tracking feature | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Session data | Automatic | Authentication, security | Art. 6(1)(f) — legitimate interest | Art. 7(IX) — legitimate interest |
| IP address (rate limiting) | Automatic (Redis, not persisted) | Abuse prevention | Art. 6(1)(f) — legitimate interest | Art. 7(IX) — legitimate interest |
| User preferences | User input | Personalization | Art. 6(1)(b) — contractual necessity | Art. 7(V) — contract execution |
| Google Calendar tokens | Google OAuth (calendar scope) | Calendar sync feature | Art. 6(1)(a) — explicit consent | Art. 7(I) — consent |

> [!NOTE]
> **Calendar sync uses consent** (not contractual necessity) because it's an optional feature the user explicitly opts into. This means users can withdraw consent at any time by disconnecting their calendar.

#### Third-Party Data Processors

| Third Party | What They Receive | Purpose |
|---|---|---|
| Google (OAuth) | Email, name (from Google to us) | Authentication |
| Google (Calendar API) | Event titles, dates, times (from us to Google) | Calendar sync (opt-in) |

#### Data NOT Collected
- No analytics or tracking cookies
- No advertising identifiers
- No browsing history
- No profile pictures (Google profile photo is not stored)
- No Google access/refresh tokens for login (ID token is verified and discarded)

#### User Rights (GDPR Chapter III / LGPD Chapter III)

| Right | Implementation |
|---|---|
| Access (Art. 15 / Art. 18(II)) | Data export in Settings |
| Rectification (Art. 16 / Art. 18(III)) | Edit profile in Settings |
| Erasure (Art. 17 / Art. 18(VI)) | Delete account in Settings — cascading delete of all data |
| Data portability (Art. 20 / Art. 18(V)) | JSON export of all user data |
| Restriction of processing (Art. 18) | Account deactivation |
| Object to processing (Art. 21 / Art. 18(IV)) | Contact DPO |
| Withdraw consent (Art. 7(3) / Art. 8(§5)) | Disconnect Google Calendar in Settings |

#### Data Retention
- Account data: retained while account is active
- Session data: auto-expires (idle: 30 days, absolute: 90 days)
- Rate limiting data: Redis, auto-expires after 15 minutes
- Deleted account: all data permanently removed within 30 days
- Google Calendar tokens: deleted immediately on disconnect or account deletion

#### Data Security
- Passwords hashed with Argon2id
- Sessions use opaque tokens (SHA-256 hashed in DB)
- Google Calendar tokens encrypted at rest (AES-256-GCM)
- All traffic over HTTPS (TLS 1.2+)
- HttpOnly, Secure, SameSite session cookies

#### Contact
- Data Protection contact email (to be configured)
- For LGPD: designated "Encarregado" (DPO equivalent)

---

### 2. Cookie Policy (`/cookies` or section within Privacy Policy)

Planner uses minimal cookies:

| Cookie | Type | Purpose | Duration | Consent Required? |
|---|---|---|---|---|
| `planner_session` / `__Host-planner_session` | Strictly necessary | Authentication session | Sliding 30-day idle / 90-day absolute | ❌ No — strictly necessary |
| `planner_csrf` | Strictly necessary | CSRF protection | Session | ❌ No — strictly necessary |

**No consent banner needed.** All cookies are strictly necessary for the service to function. There are no analytics, marketing, or preference cookies.

> [!NOTE]
> When the Google Identity Services (GIS) JavaScript library is loaded for Google login, Google may set its own cookies. These are covered by Google's own cookie policy and are classified as strictly necessary for the OAuth flow.

---

### 3. Terms of Service (`/terms`)

Basic terms covering:
- Service description (task management application)
- User responsibilities (accurate information, acceptable use)
- Account termination (user can delete anytime; we can disable for abuse)
- Intellectual property (user owns their data; we own the software)
- Limitation of liability (standard disclaimers)
- Governing law (to be determined — likely Brazilian law given LGPD focus)
- Changes to terms (notification via email or in-app)

---

## Implementation

### Backend

No new API endpoints needed for static legal pages. These are frontend-only pages rendered from static content.

However, we need:

#### Data Export Endpoint
`GET /api/v1/account/export` — returns JSON export of all user data:

```typescript
{
  user: { email, displayName, createdAt },
  preferences: { ... },
  collections: [...],
  tasks: [...],
  labels: [...],
  sections: [...],
  habits: [...],
  habitCompletions: [...],
  filters: [...],
  comments: [...],
  reminders: [...]
}
```

#### Account Deletion Endpoint
`DELETE /api/v1/account` — permanently deletes user and all associated data:

1. Revoke all sessions
2. Disconnect Google Calendar (revoke tokens)
3. Delete user record (CASCADE handles everything else)
4. Clear session cookie

Both endpoints require authentication.

### Frontend

#### New Pages
- `PrivacyPage` at `/privacy` — public, no auth required
- `TermsPage` at `/terms` — public, no auth required
- Cookie policy integrated as a section within Privacy page

#### Content Format
Legal pages should be rendered from structured JSX (not markdown) so they can:
- Use the Planner design system (Lora font, cream background)
- Include proper heading hierarchy for accessibility
- Be updated without rebuilding (consider future i18n)

#### Design
- Same `AuthShell`-style centered layout but wider (max-width ~720px)
- Table of contents sidebar for longer pages
- Paper-journal aesthetic maintained
- Print-friendly CSS (for users who want a PDF)

#### Navigation Updates
- Add "Privacy" and "Terms" links to:
  - Login page footer
  - Register page footer
  - Settings page (or app footer)

### Registration Flow Update

Add a consent line below the register button:

```
By creating an account, you agree to our [Terms of Service] and [Privacy Policy].
```

This is informational (no checkbox) since the legal basis is contractual necessity, not consent.

---

## Internationalization

Legal pages should support i18n (Portuguese and English at minimum):
- Portuguese version required for LGPD compliance with Brazilian users
- English version as the default
- Use the existing i18next infrastructure (from `.specs/2026-07-25-i18next-migration`)

> [!IMPORTANT]
> If i18next migration is not yet complete, start with English only and add Portuguese as a follow-up task.

---

## Testing

### Backend
- [ ] Unit test: data export endpoint returns all user data categories
- [ ] Unit test: data export excludes sensitive fields (password_hash, token hashes)
- [ ] Unit test: account deletion cascades to all related tables
- [ ] Unit test: account deletion revokes Google Calendar tokens
- [ ] Integration test: export → delete → verify no data remains

### Frontend
- [ ] Unit test: Privacy page renders with correct heading structure
- [ ] Unit test: Terms page renders
- [ ] Unit test: Login/Register pages link to Privacy and Terms
- [ ] Unit test: Registration consent text present

---

## Manual Verification

1. Navigate to `/privacy` — page renders with full content
2. Navigate to `/terms` — page renders with full content
3. Login page footer shows Privacy and Terms links
4. Register page shows consent text with links
5. Settings → Export Data → downloads JSON with all user data
6. Settings → Delete Account → permanently removes all data
7. After deletion, login attempt fails
8. Privacy page is accessible without authentication
