# Privacy, Cookies & Legal Basis - Tasks

## 1. Environment & Branch Setup

- [x] 1.1 Create worktree `../planner-privacy-legal` on branch `feat/privacy-legal`, configure `.env` and git hooks, and start Docker stack
- [x] 1.2 Update `.specs/2026-08-07-privacy-legal/plan.md` and `task.md` to match project conventions (no em dashes, dedicated type files, centralized Relevant Files) and open Draft PR

## 2. Backend - Account Data Export & Deletion (TDD)

- [ ] 2.1 Create `api/src/types/account.ts` with dedicated types (`AccountExportData`, `ExportedUser`, `ExportedCollection`, `ExportedTask`, `ExportedLabel`, `ExportedSection`, `ExportedHabit`, `ExportedHabitCompletion`, `ExportedFilter`, `ExportedComment`, `ExportedReminder`)
- [ ] 2.2 Write unit tests in `api/src/services/__tests__/accountService.test.ts` covering:
  - `exportUserData` returns all user data categories (`user`, `preferences`, `collections`, `tasks`, `labels`, `sections`, `habits`, `habitCompletions`, `filters`, `comments`, `reminders`)
  - `exportUserData` excludes sensitive fields (`password_hash`, `passwordHash`, session tokens, API token hashes)
  - `exportUserData` throws `NOT_FOUND` (404) if user does not exist
  - `deleteUserAccount` revokes sessions, API tokens, OAuth grants, and deletes the user row
- [ ] 2.3 Implement `api/src/services/accountService.ts` (`exportUserData` and `deleteUserAccount`)
- [ ] 2.4 Implement `api/src/routes/account.ts` (`GET /api/v1/account/export` and `DELETE /api/v1/account` clearing session and CSRF cookies) and register in `api/src/routes/index.ts` with `requireSession`
- [ ] 2.5 Write real PostgreSQL + Redis integration tests in `api/src/routes/__tests__/account.integration.test.ts` verifying:
  - `GET /api/v1/account/export` returns complete user dataset across all tables and omits `password_hash` and token hashes
  - `DELETE /api/v1/account` cascades deletion across all related tables, clears cookies, invalidates the session, and causes subsequent login to fail

## 3. Frontend - Types, i18n & Legal Content

- [ ] 3.1 Create `app/src/types/account.ts` and `app/src/types/legal.ts` for dedicated frontend types
- [ ] 3.2 Add English and Brazilian Portuguese UI keys in `app/src/i18n/locales/en.ts` and `app/src/i18n/locales/pt-BR.ts` (footer links, register consent copy, Settings Data & Privacy section)
- [ ] 3.3 Create `app/src/i18n/legalContent.ts` with complete English (`en`) and Brazilian Portuguese (`pt-BR`) structured content for:
  - Privacy Policy (Data We Collect table with GDPR & LGPD bases, Data Not Collected, Third-Party Processors, Cookie Policy table, User Rights table, Data Retention, Data Security, Contact / DPO)
  - Terms of Service (Service Description, User Responsibilities, Account Termination, Intellectual Property, Limitation of Liability, Governing Law, Changes to Terms)

## 4. Frontend - Legal Pages & Auth Links (TDD)

- [ ] 4.1 Write unit tests in `app/src/pages/__tests__/LegalPages.test.tsx` for `PrivacyPage` (`/privacy`) and `TermsPage` (`/terms`) (heading hierarchy, data collection table, cookie policy section, user rights, terms sections, TOC links, and `pt-BR` translation)
- [ ] 4.2 Create `app/src/components/LegalLayout.tsx`, `app/src/pages/PrivacyPage.tsx`, `app/src/pages/TermsPage.tsx`, add print styles in `app/src/index.css`, and register public routes `/privacy` and `/terms` in `app/src/App.tsx`
- [ ] 4.3 Update `app/src/pages/__tests__/LoginPage.test.tsx` and `app/src/pages/__tests__/RegisterPage.test.tsx` to assert Privacy and Terms links and registration consent notice
- [ ] 4.4 Update `app/src/pages/LoginPage.tsx` and `app/src/pages/RegisterPage.tsx` with footer links to `/privacy` and `/terms` and the registration consent line

## 5. Frontend - Account Management in Settings (TDD)

- [ ] 5.1 Add `apiExportAccountData()` and `apiDeleteAccount()` to `app/src/api/client.ts` (excluding `/account` from offline queue)
- [ ] 5.2 Write unit tests in `app/src/components/settings/__tests__/AccountDataSection.test.tsx` for data export JSON download, delete account confirmation modal, API call, and redirect on deletion
- [ ] 5.3 Implement `app/src/components/settings/AccountDataSection.tsx` and integrate into `app/src/pages/SettingsPage.tsx`

## 6. End-to-End Verification & Visual Check

- [ ] 6.1 Create Playwright E2E test `app/e2e/privacyLegal.spec.ts` verifying public `/privacy` and `/terms` access, login/register legal links and consent notice, Settings data export download, account deletion, and post-deletion login failure
- [ ] 6.2 Run full API and App lint, build, unit/integration tests, and Playwright E2E tests
- [ ] 6.3 Inspect live routes in Playwright browser at `https://antigravity.planner.local`, verify zero console errors, capture desktop and mobile screenshots in `app/dist/screenshots/`, and mark PR Ready for Review
