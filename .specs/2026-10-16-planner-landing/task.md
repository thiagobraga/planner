# Planner landing page implementation checklist

Status: specification saved; implementation has not started.

## 1. Establish isolated development and reference evidence

- [ ] Create `/p/projects/planner-planner-landing` on `feat/planner-landing` from the agreed base, preserving unrelated edits in the original checkout.
  - [ ] Include this specification in the worktree and run `bash .hooks/setup-hooks.sh`.
  - [ ] Configure a dedicated Compose project and unique app/site preview hosts using `.env.example` conventions.
  - [ ] Check certificate coverage before adding hosts; regenerate trusted local certificates and reload Traefik when required by the repository workflow.
  - [ ] Push the initial scoped specification commit and open a draft PR against `main` before development.
- [ ] Inspect both supplied archives and render the original Opus export as an isolated comparison fixture outside the product source.
  - [ ] Capture matching reference views at 1440x1000, 768x1024, and 390x844, with fonts loaded and motion frozen.
  - [ ] Exclude Arena hosting chrome from comparisons. The supplied Opus export is the source for page geometry and assets.
  - [ ] Record current app theme regression results before extracting shared styles.

## 2. Scaffold the standalone site package and Docker preview

- [ ] Create `site/` with the versions and configuration patterns from `app/package.json`, its lockfile, TypeScript, ESLint, Vite, Vitest, and Playwright configurations.
  - [ ] Provide `dev`, `build`, `preview`, `lint`, `test`, `coverage`, and `test:e2e` scripts plus a typecheck gate.
  - [ ] Use existing dependency choices only; omit PWA, offline, auth, Socket.IO, and application data providers.
  - [ ] Keep new interfaces and types under `site/src/types/`.
  - [ ] Copy the app's `.npmrc` policy and generate an independent site lockfile and dependency installation.
- [ ] Add `.docker/site/Dockerfile` using the app's Node and nginx image versions, development/build/production target conventions, nonroot runtime, healthcheck, and entrypoint behavior.
  - [ ] Copy package manifests, lockfile, and `.npmrc` before source for dependency caching.
  - [ ] Preserve access to the shared stylesheet in both development mounts and production build context.
  - [ ] Add `.docker/site/nginx.conf` with static serving, existing security headers, immutable hashed assets, and revalidated HTML. Omit API/OAuth/socket proxying and service-worker handling.
- [ ] Add an independently runnable `site` service to `compose.yml` with its own dependency volume and unique Traefik host.
  - [ ] Use Vite port 5174 internally and document the site host environment setting in `.env.example`.
  - [ ] Do not add API, database, or Redis startup dependencies to the site service.
  - [ ] Launch the browser preview at development start and keep it available for iteration.

## 3. Share exact palettes and implement public theme selection

- [ ] Write regression coverage for app palette behavior and site theme initialization before changing shared styles.
- [ ] Extract pure palette/theme declarations from `app/src/index.css` into `app/src/styles/theme.css`; import them from app and site without changing app computed styles.
  - [ ] Preserve beige, white, dark, overlay, text, border, accent, and surface values and their selector semantics.
  - [ ] Keep app-only component CSS separate. Do not import the app's entrypoint or authenticated theme control.
  - [ ] Map Opus aliases to shared tokens; retain reference geometry and local radius/spacing choices rather than inheriting conflicting app dimensions.
- [ ] Add a public theme selector with White, Beige, and Dark controls in desktop and mobile navigation.
  - [ ] Default to Beige and persist a namespaced value such as `planner-site-theme`.
  - [ ] Apply valid stored choices before first paint; gracefully handle invalid values and unavailable local storage.
  - [ ] Apply theme tokens to controls and rendered device mockups, leaving the desk photograph unchanged.
  - [ ] Test all choices, persistence, fallback behavior, focus, and accessible selected state.

## 4. Port the Opus page and correct product content

- [ ] Port Opus `src/App.tsx`, `src/Mockups.tsx`, styles, and `public/desk.jpg` into the site, separating coherent components without redesigning the reference.
  - [ ] Preserve hero text, font weights, italic treatment, widths, backgrounds, overlapping devices, grid geometry, section rhythm, motion, and responsive breakpoints.
  - [ ] Preserve the feature, showcase, benefits, FAQ, and closing-panel compositions.
  - [ ] Use Gemini only as a secondary reference for theme selection; do not import its layout or visual density.
- [ ] Replace unsupported content while keeping the reference's visual density.
  - [ ] Replace the four proof metrics with daily planning, habits, real-time sync, and MIT licensing.
  - [ ] Replace testimonial cards with three factual use cases: daily planning, habit tracking, and connecting AI agents through MCP. Remove fabricated quotes, people, ratings, and audience counts.
  - [ ] Replace subscription cards with hosted app, self-hosting, and contributing options; remove prices, trial promises, billing switch, and subscription FAQ answers.
  - [ ] Update navigation to the replacement section and correct unsupported capability claims in hero badges, features, benefits, and FAQ.
  - [ ] Replace the simulated email form with a registration action, retaining the closing panel's composition.
- [ ] Define `VITE_APP_URL` with default `https://planner.thiagobraga.dev`; derive registration links using `/register`. Keep the GitHub destination `https://github.com/thiagobraga/planner`.
- [ ] Implement and test mobile navigation, anchors, showcase tabs, local mockup task completion, and FAQ disclosure behavior.
  - [ ] Use semantic links/buttons, correct tab and disclosure relationships, visible focus, and keyboard controls.
  - [ ] Keep content visible if reveal initialization fails and respect reduced motion.
  - [ ] Keep demo state local; do not call real task APIs or simulate successful signup.

## 5. Integrate repository verification

- [ ] Add site package support to `.hooks/_lib.sh` and inspect hook callers for app-specific assumptions before enabling it.
- [ ] Add site to root `vitest.config.ts` test discovery.
- [ ] Update `.github/workflows/ci.yml` path detection and quality job wiring for site and shared theme changes.
- [ ] Extend `.github/workflows/2a.quality.yml` to run site lint, typecheck, tests, build, and standalone Playwright checks. Preserve visible dependencies and existing app/API checks.
- [ ] Extend `.github/workflows/2b.security.yml` dependency auditing and `.github/workflows/2c.container.yml` site production build/scan coverage.
- [ ] Add `/site` npm and `/.docker/site` Docker entries to `.github/dependabot.yml` following existing grouping and cooldown policy.
- [ ] Update `README.md` with compact site setup and validation instructions. Do not change live production routing or release/deployment topology.

## 6. Verify fidelity, runtime, and delivery

- [ ] Run site lint, typecheck, unit tests, build, and Playwright from its own dependencies or Docker stack.
- [ ] Compare the rendered site with the original Opus fixture at matching desktop, tablet, and phone widths.
  - [ ] Freeze animations and wait for fonts/assets before screenshots. Compare unchanged sections directly and record intentional copy/theme changes.
  - [ ] Inspect the full page, not just the hero; resolve visible unexplained differences before completion.
  - [ ] Verify White, Beige, and Dark at desktop and narrow widths; check reload persistence and initial paint.
  - [ ] Exercise navigation, tabs, mockup tasks, FAQ, destination links, keyboard flow, and reduced motion.
  - [ ] Confirm no horizontal overflow, missing images, console errors, hidden sections, manifest, or service-worker registration.
- [ ] Run app theme unit and relevant browser regressions after shared-style extraction.
- [ ] Build and smoke-test the production nginx image without the API/database/Redis; inspect HTML/assets, cache/security headers, and healthcheck.
- [ ] Run applicable workflow and Docker static checks and inspect fresh CI results.
- [ ] Save desktop and narrow screenshots for every theme under `app/dist/screenshots/` in the worktree and link them in delivery notes.
- [ ] Create scoped Conventional Commits with the required model co-author trailer, push verified milestones, and update this checklist as work progresses.
- [ ] Mark the PR ready when required checks and visual review pass. Report changed files, visual evidence, and any validation gaps; leave the worktree stack running for review.
