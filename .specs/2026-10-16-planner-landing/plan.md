# Planner landing page

## Goal

Create Planner's public landing page in `site/`. It should feel like the Opus Arena reference, with the same composition, typography, illustrations, effects, animations, and responsive behavior. Visitors should understand Planner, explore its interface, choose a theme, and reach the real application or source repository.

## References and agreed decisions

- Primary reference: https://01a13d59-0319-73b1-86d5-379af9ed17a7.arena.site/
- Primary source export: `/t/Downloads/premium-planner-app-landing-page (1).zip`.
- Secondary reference: https://01a13d59-0319-726e-8b48-59517363b378.arena.site/
- Secondary source export: `/t/Downloads/premium-planner-app-landing-page.zip`.
- Opus is the visual authority. Gemini may inform the theme selector, without changing the Opus layout.
- Preserve Opus geometry, shadows, blur, and other effects where they conflict with `DESIGN.md`. Use Planner's Lora typography and actual theme palettes.
- Replace invented pricing, statistics, testimonials, and signup success messages with verified Planner information and working destinations.
- Implement in a new worktree on `feat/planner-landing`, with a dedicated Docker preview and draft PR.

## Visitor experience

### Page composition

Keep the Opus centered hero and its headline, "The calm of paper. The power of an app." Preserve the italic accent line, dotted canvas, overlapping laptop/tablet/phone mockups, feature grid, showcase tabs, benefits, FAQ, and closing panel.

Maintain the reference's section order, proportions, visual density, and responsive layouts while making these content changes:

- Replace fabricated metrics with factual highlights: daily planning, habits, real-time sync, and MIT licensing.
- Replace testimonials with three Planner use cases, retaining the card layout.
- Replace paid subscription plans with hosted app, self-hosting, and contributing options. Remove billing controls and unsupported pricing promises; update navigation accordingly.
- Replace simulated email signup with a working registration link. Do not display a success message for an email that was never sent.
- Keep English copy. Describe only verified capabilities; do not promise offline behavior, native apps, support commitments, or data guarantees based solely on reference copy.

The primary actions lead to Planner registration. GitHub and self-hosting actions lead to `https://github.com/thiagobraga/planner`. The application destination is configurable and defaults to `https://planner.thiagobraga.dev`.

### Themes and interaction

Offer White, Beige, and Dark on both desktop and mobile. Default to Beige, remember the visitor's choice locally, and apply it before the first paint. All page surfaces, controls, and rendered device mockups should respond to the selection. The desk photograph remains the supplied photograph.

Use the application's exact current palettes, including its intentional white page background and warm dark colors. Theme selection on the public site must work without signing in.

Keep working mobile navigation, section anchors, showcase tabs, FAQ disclosure controls, and local task completion in the interactive mockup. Provide keyboard access, visible focus, and reduced-motion behavior. Demonstration tasks must not change real Planner data.

## Delivery and boundaries

The site reuses the app's React, TypeScript, Vite, Tailwind, Docker, and testing conventions. It is a separate package that can render without the API, PostgreSQL, or Redis. It has no service worker, web app manifest, or offline storage.

Prepare a production static nginx image and integrate site validation into repository hooks and CI. Deploying to production, choosing a public site hostname, and changing the existing application router are outside this build.

Keep the worktree preview running during review. Mark the draft PR ready after implementation and verification pass.

## Acceptance criteria

- The site is implemented under `site/` using the supplied Opus source and assets.
- Unchanged sections match Opus at matching desktop, tablet, and phone widths. Intentional differences are limited to agreed content corrections and theme adaptation.
- White, Beige, and Dark work throughout the page and survive reload without a wrong-theme flash.
- Every visible control works; signup and repository links use real destinations.
- The page has no horizontal overflow, missing assets, blank revealed sections, or unexplained console errors.
- Keyboard and reduced-motion flows work.
- Site lint, typecheck, unit tests, Playwright tests, production build, and Docker smoke checks pass. App theme regressions pass after shared styles are extracted.
- Desktop and narrow screenshots for all themes are saved under the worktree's `app/dist/screenshots/` and linked in delivery notes.

## Relevant Files

### Source and design references

- `DESIGN.md`
- `app/package.json`, `app/package-lock.json`, `app/.npmrc`
- `app/vite.config.ts`, `app/tsconfig.json`, `app/eslint.config.js`
- `app/vitest.config.ts`, `app/playwright.config.ts`
- `app/src/index.css`, `app/src/utils/theme.ts`, `app/src/types/theme.ts`
- `app/src/components/ui/ThemeSwitcher.tsx`
- `app/src/utils/__tests__/theme.test.ts`, `app/e2e/darkTheme.spec.ts`
- `.docker/app/Dockerfile`, `.docker/app/entrypoint.sh`, `.docker/app/nginx.conf`

### New site and shared styles

- `site/package.json`, `site/package-lock.json`, `site/.npmrc`, `site/index.html`
- `site/vite.config.ts`, `site/tsconfig.json`, `site/eslint.config.js`
- `site/vitest.config.ts`, `site/playwright.config.ts`
- `site/src/main.tsx`, `site/src/App.tsx`, `site/src/index.css`
- `site/src/components/`, `site/src/types/`, `site/src/test/`, `site/e2e/`, `site/public/`
- `app/src/styles/theme.css`
- `.docker/site/Dockerfile`, `.docker/site/nginx.conf`

### Repository integration and evidence

- `compose.yml`, `.env.example`, `README.md`, `vitest.config.ts`
- `.hooks/_lib.sh` and affected package-specific hook commands
- `.github/workflows/ci.yml`, `.github/workflows/2a.quality.yml`
- `.github/workflows/2b.security.yml`, `.github/workflows/2c.container.yml`
- `.github/dependabot.yml`
- `app/dist/screenshots/`
- `.specs/2026-10-16-planner-landing/task.md`
