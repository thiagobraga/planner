# Privacy, Cookies & Legal Basis - Plan

## Goal

Provide transparent, GDPR- and LGPD-compliant Privacy Policy (`/privacy`, including Cookie Policy) and Terms of Service (`/terms`) pages, along with self-service account data export (`GET /api/v1/account/export`) and permanent account deletion (`DELETE /api/v1/account`) in Settings.

## Context

Planner requires public legal pages and self-service data rights controls for:
- Launching Google OAuth login and Calendar integrations (Google requires public Privacy Policy and Terms of Service URLs on the OAuth consent screen)
- GDPR compliance (EU users) and LGPD compliance (Brazilian users)
- Giving users full ownership of their data with one-click JSON export and immediate cascading account deletion

---

## What It Does & User Flows

### 1. Public Privacy Policy & Cookie Policy (`/privacy`)

Accessible to anyone without signing in (and also accessible while signed in). Rendered in Planner's paper-journal aesthetic (Lora serif, warm cream palette, 24px vertical baseline, `max-w-[720px]` reading column with a sticky Table of Contents sidebar and print-friendly styles). Supports both English (`en`) and Brazilian Portuguese (`pt-BR`).

Covers the following sections:

#### Data We Collect & Legal Basis

| Data Category | Source | Purpose | Legal Basis (GDPR) | Legal Basis (LGPD) |
|---|---|---|---|---|
| Email address | Registration / Google OAuth | Account identification, login | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Display name | Registration / Google OAuth | Personalization | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Password hash | Registration | Authentication | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Google user ID | Google OAuth | Account linking | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Tasks, notes, events | User input | Core service functionality | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Collections, labels | User input | Organization features | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Habits, completions | User input | Habit tracking feature | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Session data | Automatic | Authentication, security | Art. 6(1)(f) - legitimate interest | Art. 7(IX) - legitimate interest |
| IP address (rate limiting) | Automatic (Redis, not persisted) | Abuse prevention | Art. 6(1)(f) - legitimate interest | Art. 7(IX) - legitimate interest |
| User preferences | User input | Personalization | Art. 6(1)(b) - contractual necessity | Art. 7(V) - contract execution |
| Google Calendar tokens | Google OAuth (calendar scope) | Calendar sync feature | Art. 6(1)(a) - explicit consent | Art. 7(I) - consent |

> [!NOTE]
> **Calendar sync uses consent** (not contractual necessity) because it is an optional feature the user explicitly opts into. Users can withdraw consent at any time by disconnecting their calendar.

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

#### Cookie Policy (Section within `/privacy`)

| Cookie | Type | Purpose | Duration | Consent Required? |
|---|---|---|---|---|
| `planner_session` / `__Host-planner_session` | Strictly necessary | Authentication session | Sliding 30-day idle / 90-day absolute | No - strictly necessary |
| `planner_csrf` / `__Host-planner_csrf` | Strictly necessary | CSRF protection | Session | No - strictly necessary |

**No cookie consent banner is needed** because all cookies are strictly necessary for authentication and security. There are no analytics, marketing, or tracking cookies.

#### User Rights (GDPR Chapter III / LGPD Chapter III)

| Right | Implementation |
|---|---|
| Access (Art. 15 / Art. 18(II)) | Data export in Settings |
| Rectification (Art. 16 / Art. 18(III)) | Edit profile and preferences in Settings |
| Erasure (Art. 17 / Art. 18(VI)) | Delete account in Settings - cascading delete of all data |
| Data portability (Art. 20 / Art. 18(V)) | JSON export of all user data |
| Restriction of processing (Art. 18) | Account deactivation / contact DPO |
| Object to processing (Art. 21 / Art. 18(IV)) | Contact DPO |
| Withdraw consent (Art. 7(3) / Art. 8(5)) | Disconnect integrations / Google Calendar in Settings |

#### Data Retention
- Account data: retained while account is active
- Session data: auto-expires (idle: 30 days, absolute: 90 days)
- Rate limiting data: Redis, auto-expires after 15 minutes
- Deleted account: all database records permanently removed immediately upon deletion
- Google Calendar / OAuth tokens: deleted immediately on disconnect or account deletion

#### Data Security
- Passwords hashed with Argon2id
- Sessions and API tokens use opaque random secrets (SHA-256 hashed in DB)
- Google Calendar tokens encrypted at rest (AES-256-GCM)
- All traffic over HTTPS (TLS 1.2+)
- HttpOnly, Secure, SameSite=Lax session cookies

#### Contact & Data Protection Officer (Encarregado)
- Data Protection contact email (`privacy@thiagobraga.dev`) and designated LGPD Encarregado information.

---

### 2. Public Terms of Service (`/terms`)

Accessible without authentication at `/terms`. Uses the same paper-journal legal layout (`max-w-[720px]`, Table of Contents sidebar, print-friendly CSS) and supports English (`en`) and Brazilian Portuguese (`pt-BR`).

Covers:
1. Service description (Bullet Journal-inspired task and habit management application)
2. User responsibilities (accurate account information, credential security, acceptable use)
3. Account termination (users can export data and delete their account at any time; abuse may result in suspension)
4. Intellectual property (users retain full ownership of their content and data; Planner owns the application software under its license)
5. Limitation of liability (service provided "as is" without warranties)
6. Governing law (laws of Brazil, honoring GDPR and LGPD protections)
7. Changes to terms (notice provided via email or in-app announcement)

---

### 3. Auth & Navigation Links

- **Login page (`/login`)**: Footer links to Privacy Policy (`/privacy`) and Terms of Service (`/terms`).
- **Register page (`/register`)**:
  - Informational consent notice below the submit button:
    `By creating an account, you agree to our Terms of Service and Privacy Policy.` (with links to `/terms` and `/privacy`).
  - Footer links to Privacy Policy (`/privacy`) and Terms of Service (`/terms`).
- **Settings page (`/settings/general`)**:
  - Links to Privacy Policy (`/privacy`) and Terms of Service (`/terms`).

---

### 4. Self-Service Data Export & Account Deletion in Settings

In Settings (`General` tab), a dedicated **Data & Privacy** (`AccountDataSection`) section provides:

1. **Export Data (`GET /api/v1/account/export`)**:
   - Clicking **Export data** fetches all user data (`user`, `preferences`, `collections`, `tasks`, `labels`, `sections`, `habits`, `habitCompletions`, `filters`, `comments`, `reminders`) and downloads a formatted JSON file (`planner-data-export.json`).
   - Strictly excludes sensitive internal fields (`password_hash`, session hashes, token hashes).
2. **Delete Account (`DELETE /api/v1/account`)**:
   - Clicking **Delete account** opens a confirmation modal explaining that deletion is permanent and removes all tasks, collections, habits, and settings.
   - Confirming calls `DELETE /api/v1/account`, which revokes all sessions, API tokens, and OAuth grants, deletes the user row (cascading to all user tables), clears session/CSRF cookies, ends the local client session, and redirects to `/login`.

---

## Relevant Files

### Backend (`api/`)
- `api/src/types/account.ts` (new) - Dedicated TypeScript interfaces for account data export (`AccountExportData` and entity export shapes).
- `api/src/services/accountService.ts` (new) - `exportUserData(userId)` and `deleteUserAccount(userId)` service functions.
- `api/src/routes/account.ts` (new) - `GET /api/v1/account/export` and `DELETE /api/v1/account` route handlers.
- `api/src/routes/index.ts` - Registers `/account` routes behind `requireSession`.
- `api/src/services/__tests__/accountService.test.ts` (new) - Unit tests for `exportUserData` and `deleteUserAccount`.
- `api/src/routes/__tests__/account.integration.test.ts` (new) - Real PostgreSQL + Redis integration tests verifying complete export, exclusion of sensitive fields, cascading deletion across all tables, session/cookie clearing, and post-deletion login rejection.

### Frontend (`app/`)
- `app/src/types/account.ts` (new) - Frontend TypeScript interfaces for `AccountExportData`.
- `app/src/types/legal.ts` (new) - Dedicated TypeScript interfaces for structured legal page content (`PrivacyPolicyContent`, `TermsOfServiceContent`, `LegalSection`).
- `app/src/i18n/legalContent.ts` (new) - Localized structured content (`en` and `pt-BR`) for Privacy Policy, Cookie Policy, and Terms of Service.
- `app/src/i18n/locales/en.ts` - English translation strings for auth consent notice, footer links, and Settings Data & Privacy controls.
- `app/src/i18n/locales/pt-BR.ts` - Brazilian Portuguese translation strings for auth consent notice, footer links, and Settings Data & Privacy controls.
- `app/src/api/client.ts` - Adds `apiExportAccountData()` and `apiDeleteAccount()` and excludes `/account` from offline mutation queueing.
- `app/src/components/LegalLayout.tsx` (new) - Shared paper-journal layout for `/privacy` and `/terms` (`max-w-[720px]`, header with navigation back to Planner, sticky Table of Contents sidebar, print-friendly classes).
- `app/src/pages/PrivacyPage.tsx` (new) - Public Privacy Policy and Cookie Policy page (`/privacy`).
- `app/src/pages/TermsPage.tsx` (new) - Public Terms of Service page (`/terms`).
- `app/src/components/settings/AccountDataSection.tsx` (new) - Settings section for exporting user data, deleting the account with confirmation modal, and linking to `/privacy` and `/terms`.
- `app/src/pages/SettingsPage.tsx` - Renders `AccountDataSection` in General settings.
- `app/src/pages/LoginPage.tsx` - Adds Privacy and Terms links in the footer.
- `app/src/pages/RegisterPage.tsx` - Adds registration consent line and Privacy/Terms links.
- `app/src/App.tsx` - Registers public `/privacy` and `/terms` routes outside the auth guard.
- `app/src/index.css` - Adds `@media print` utility styles for clean printing of legal pages.
- `app/src/pages/__tests__/LegalPages.test.tsx` (new) - Unit tests for `PrivacyPage` and `TermsPage` rendering, headings, cookie section, and localization.
- `app/src/pages/__tests__/LoginPage.test.tsx` - Unit tests verifying Privacy and Terms links on Login page.
- `app/src/pages/__tests__/RegisterPage.test.tsx` - Unit tests verifying consent text and Privacy/Terms links on Register page.
- `app/src/components/settings/__tests__/AccountDataSection.test.tsx` (new) - Unit tests for data export download and account deletion confirmation flow.
- `app/e2e/privacyLegal.spec.ts` (new) - Playwright E2E tests covering public `/privacy` and `/terms` pages, login/register links, data export, and account deletion flow.
