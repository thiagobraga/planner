# Login with Google — Tasks

## Prerequisites

- [ ] Create Google Cloud project with OAuth 2.0 credentials
- [ ] Configure OAuth consent screen (External, app name, support email)
- [ ] Add `GOOGLE_CLIENT_ID` to `.env.example` and document

## Backend — Database

- [ ] Create migration `037_google_oauth.sql` — nullable `password_hash`, add `google_id` column

## Backend — Auth Service

- [ ] Add `google-auth-library` dependency
- [ ] Implement `loginWithGoogle(idToken)` in `authService.ts`
- [ ] Implement `findUserByGoogleId(googleId)` helper
- [ ] Implement `linkGoogleAccount(userId, googleId)` helper
- [ ] Implement `createGoogleUser({ email, displayName, googleId })` (transaction with Inbox + preferences)
- [ ] Harden `login()` — reject OAuth-only users with clear message
- [ ] Harden `resetPassword()` — reject OAuth-only users with clear message
- [ ] Add `POST /api/v1/auth/google` route with IP rate limiting
- [ ] Register new route in `routes/index.ts`

## Backend — Tests

- [ ] Unit test: `loginWithGoogle` creates new user
- [ ] Unit test: `loginWithGoogle` links existing email user
- [ ] Unit test: `loginWithGoogle` logs in existing Google-linked user
- [ ] Unit test: `loginWithGoogle` rejects unverified Google email
- [ ] Unit test: `loginWithGoogle` rejects disabled accounts
- [ ] Unit test: `login()` rejects OAuth-only users
- [ ] Unit test: `resetPassword()` rejects OAuth-only users
- [ ] Integration test: full Google OAuth route (mocked token verification)

## Frontend — Google Identity Services

- [ ] Add GIS `<script>` tag to `index.html`
- [ ] Create `useGoogleLogin` hook
- [ ] Add `apiLoginWithGoogle(idToken)` to `client.ts`
- [ ] Add `loginWithGoogle` to `AuthContext`
- [ ] Add `VITE_GOOGLE_CLIENT_ID` env var support

## Frontend — UI

- [ ] Add "Sign in with Google" button to `LoginPage.tsx`
- [ ] Add "Sign up with Google" button to `RegisterPage.tsx`
- [ ] Add "or" separator styling (CSS)
- [ ] Follow Google branding guidelines for button design
- [ ] Maintain Planner design system (Lora, cream palette)

## Frontend — Tests

- [ ] Unit test: Login page renders Google sign-in button
- [ ] Unit test: Register page renders Google sign-up button
- [ ] Unit test: `AuthContext.loginWithGoogle` updates state

## GDPR / LGPD Compliance

- [ ] Create or update Privacy Policy page disclosing Google OAuth
- [ ] Document data received from Google and retention policy
- [ ] Verify account deletion cascades remove `google_id`

## Manual Verification

- [ ] Google sign-in popup flow → authenticated state
- [ ] New Google user auto-registration (Inbox + preferences created)
- [ ] Existing email user → auto-link with Google account
- [ ] OAuth-only user → "Forgot Password" shows clear error
- [ ] OAuth-only user → email/password login shows clear error
- [ ] Disabled account → Google sign-in returns error
- [ ] Session cookie correct (HttpOnly, Secure, SameSite)
- [ ] Socket.IO connects after Google login
- [ ] Logout properly revokes session
