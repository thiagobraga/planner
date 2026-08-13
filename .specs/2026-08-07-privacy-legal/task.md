# Privacy, Cookies & Legal Basis — Tasks

## Backend — Data Export

- [ ] Create `GET /api/v1/account/export` endpoint
- [ ] Export all user data categories (tasks, collections, labels, habits, etc.)
- [ ] Exclude sensitive fields (password_hash, token hashes, session data)
- [ ] Register route in `routes/index.ts`
- [ ] Write unit tests for export completeness
- [ ] Write unit test: sensitive fields excluded

## Backend — Account Deletion

- [ ] Create `DELETE /api/v1/account` endpoint
- [ ] Revoke all user sessions
- [ ] Disconnect Google Calendar (revoke tokens if connected)
- [ ] Delete user record (CASCADE handles related data)
- [ ] Clear session cookie in response
- [ ] Register route in `routes/index.ts`
- [ ] Write unit tests for cascading deletion
- [ ] Write integration test: export → delete → verify no data remains

## Frontend — Legal Pages

- [ ] Create `PrivacyPage` component (`/privacy`)
- [ ] Create `TermsPage` component (`/terms`)
- [ ] Cookie policy as section within Privacy page
- [ ] Add routes to `App.tsx` (public, no auth required)
- [ ] Design with paper-journal aesthetic (wider layout, ~720px)
- [ ] Add table of contents for Privacy page
- [ ] Add print-friendly CSS

## Frontend — Privacy Content

- [ ] Data collection table (what, why, legal basis)
- [ ] Third-party data processors section
- [ ] User rights section (access, rectification, erasure, portability)
- [ ] Data retention section
- [ ] Data security section
- [ ] Contact information section

## Frontend — Terms Content

- [ ] Service description
- [ ] User responsibilities
- [ ] Account termination policy
- [ ] Intellectual property
- [ ] Limitation of liability
- [ ] Governing law
- [ ] Changes to terms

## Frontend — Navigation Updates

- [ ] Add Privacy and Terms links to Login page footer
- [ ] Add Privacy and Terms links to Register page footer
- [ ] Add consent text to Register page ("By creating an account...")
- [ ] Add Privacy link to Settings page or app footer

## Frontend — Account Management in Settings

- [ ] "Export Data" button in Settings → calls export endpoint → downloads JSON
- [ ] "Delete Account" button in Settings → confirmation dialog → calls delete endpoint
- [ ] Write unit tests for export/delete UI

## Internationalization

- [ ] English content (default)
- [ ] Portuguese content (LGPD requirement) — may depend on i18next migration status

## Manual Verification

- [ ] `/privacy` renders correctly (public access)
- [ ] `/terms` renders correctly (public access)
- [ ] Login page footer links work
- [ ] Register page consent text present
- [ ] Data export downloads complete JSON
- [ ] Account deletion removes all data
- [ ] Post-deletion login fails
- [ ] Pages use Planner design system (Lora, cream)
