# Show Current App Version on Sidebar - Tasks

## 1. Environment & Setup

- [ ] 1.1 Verify git workspace status and create worktree `../planner-sidebar-app-version` on branch `feat/sidebar-app-version`
- [ ] 1.2 Verify unit test suite runs cleanly before modifications (`npm test -- src/components/__tests__/Sidebar.test.tsx`)

## 2. Version Injection & Type Setup (TDD)

- [ ] 2.1 In `app/vite.config.ts`:
  - Read `package.json` version using `node:fs` `readFileSync`
  - Define `__APP_VERSION__` in `define` block
- [ ] 2.2 Create `app/src/types/version.ts`:
  - Declare `declare const __APP_VERSION__: string;`
- [ ] 2.3 Create `app/src/utils/version.ts`:
  - Export `APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';`
- [ ] 2.4 Verify TypeScript compilation (`npx tsc -b`)

## 3. Localization Setup

- [ ] 3.1 In `app/src/i18n/locales/en.ts`:
  - Add `'nav.version': 'Version {{version}}'`
- [ ] 3.2 In `app/src/i18n/locales/pt-BR.ts`:
  - Add `'nav.version': 'Versão {{version}}'`

## 4. Sidebar Component Implementation (TDD)

- [ ] 4.1 Update `app/src/components/__tests__/Sidebar.test.tsx`:
  - Add test: `renders current app version in expanded mode`
  - Add test: `renders current app version in collapsed mode`
  - Add test: `includes localized tooltip title on version element`
- [ ] 4.2 In `app/src/components/Sidebar.tsx`:
  - Import `APP_VERSION` from `../utils/version`
  - In expanded mode: Add version container below Logout in the footer utilities with `h-6 px-3 flex items-center text-[11px] text-ink-light opacity-50 select-none`
  - In collapsed mode: Add version span below Logout button with `mt-2 text-[10px] leading-none text-ink-light opacity-50 select-none text-center`
  - Attach localized `title={t('nav.version', { version: APP_VERSION })}`

## 5. End-to-End Verification (Playwright)

- [ ] 5.1 Create `app/e2e/sidebarVersion.spec.ts`:
  - Verify version label is visible in expanded sidebar after login
  - Verify version label is visible when sidebar is collapsed
- [ ] 5.2 Run Playwright test suite (`npm run test:e2e -- sidebarVersion.spec.ts`)

## 6. Full Verification & Review

- [ ] 6.1 Run full app test suite (`npm test`)
- [ ] 6.2 Run app build (`npm run build`)
- [ ] 6.3 Run app lint (`npm run lint`)
- [ ] 6.4 Take visual test screenshot saved to `./app/dist/screenshots/sidebar-version.png`
