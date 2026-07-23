# Node 24 + React 19 Upgrade — Tasks

## Node version alignment
- [x] Decide target Node version — **Node 24** (LTS), pinned tag `node:24.18.0-alpine3.24`
- [x] Scan `node:24.18.0-alpine3.24` for vulnerabilities (trivy) — 1 CRITICAL (`tar` CVE-2026-59873, DoS via gzip bomb) + 3 HIGH found, all in npm CLI's *bundled* `node_modules` (not OS packages, not project deps). No newer 24.x/alpine3.24 patch tag exists yet (24.18.0 is latest per Docker Hub as of 2026-07-23) — nothing to bump to. Accepted risk: `api` production stage runs `npm uninstall -g npm corepack`, so the vulnerable npm-bundled `tar` never ships in the runtime image, only present in build/dev stages. `app` production is nginx-based (no Node at all). Re-scan after next 24.x-alpine3.24 patch release.
- [x] `.docker/api/Dockerfile` — align `FROM node:...` to `node:24.18.0-alpine3.24`
- [x] `.docker/app/Dockerfile` — align both `FROM node:...` stages to `node:24.18.0-alpine3.24`
- [x] Re-scan built `api`/`app` images after Dockerfile edit to confirm no new CVEs from the base bump — dev-target images carry the same 4 npm-bundled findings as the base image (no new ones) plus 15 unrelated pre-existing findings in `esbuild`'s bundled Go stdlib (dev-only build tool, already pinned via existing `overrides.esbuild`, not caused by this bump). Scanned the actual `production`-target images separately (what ships) — both **clean, 0 findings**.
- [x] `.github/workflows/quality.yml:13` — update `NODE_VERSION: '22'` → `'24'`
- [x] `.github/workflows/security.yml:33` — update `node-version: '22'` → `'24'`
- [x] `CLAUDE.md` — update "Node ≥ 20 required" → "Node ≥ 24 required"
- [x] `api/package.json` — add `engines.node` (`>=24`)
- [x] `app/package.json` — add `engines.node` (`>=24`)

## React 19 migration
- [x] `app/package.json` — bump `react` and `react-dom` to `^19`
- [x] `app/package.json` — bump `@types/react` and `@types/react-dom` to `^19`
- [x] `app/package.json` — bump `eslint-plugin-react-hooks` 5→7 (enables React Compiler rules now that the version mismatch blocking this is resolved)
- [x] `app/package.json` — bump `@vitejs/plugin-react` 4→5 (plan assumed 4→6, but v6 requires `vite ^8`; this project is on `vite ^6.1.5`, out of scope to bump — used `^5.2.0`, the latest version still supporting `vite ^6`)
- [x] Run `docker compose exec app npm run lint` — 43 findings (31 errors, 12 warnings) from v7's new React-Compiler-oriented rules on pre-existing patterns (this app doesn't use the Compiler). Downgraded those specific rules to `warn` in `eslint.config.js` (user decision) rather than fixing all 31 in this PR — lint now passes with 0 errors. Also fixed the config itself: v7's top-level `configs` are legacy-eslintrc-shaped; flat config needs `reactHooks.configs.flat["recommended-latest"]`.
- [x] Run `docker compose exec app npm test` — 635/635 passed, no `act()`-timing failures
- [x] Manual smoke test in browser: registered a throwaway account, task create + complete on Daily page, Habits page (12-week grid) — no console errors, design system intact, real-time socket connected. Logged out/revoked the test session after. Also caught a **real production build break**: `RefObject<HTMLDivElement>` (non-nullable) no longer matches React 19's `useRef` return type — fixed in `useFloatingPosition.ts` and `ContextMenu.tsx`'s `parentRef` prop type (widened to `RefObject<T | null>`). `npm run build` (used by the Docker production stage) now succeeds; verified by building and scanning the actual `production`-target images (0 CVEs).
- [ ] Optional: `app/src/components/monthly/MonthSelector.tsx` — simplify `forwardRef` + `useImperativeHandle` to plain ref-as-prop (React 19 feature, not required for correctness) — left as-is, optional/out of scope

## Vulnerability sweep
- [x] `api`: confirm clean — `docker compose exec api npm audit` → 0 vulnerabilities
- [x] `app`: `docker compose exec app npm audit fix` — resolved `brace-expansion` (GHSA-3jxr-9vmj-r5cp) and `fast-uri` (GHSA-v2hh-gcrm-f6hx), both dev-only transitive, both high severity
- [x] `app`: re-run `npm audit` to confirm 0 vulnerabilities — confirmed
- [x] `app`: re-run `npm test` after the audit fix to confirm no transitive breakage — 635/635 passed
