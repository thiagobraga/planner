# Node 24 + React 19 Upgrade — Tasks

## Node version alignment
- [x] Decide target Node version — **Node 24** (LTS), pinned tag `node:24.18.0-alpine3.24`
- [ ] Scan `node:24.18.0-alpine3.24` for vulnerabilities (`docker scout cves` or `trivy image`) before locking the tag in
- [ ] `.docker/api/Dockerfile` — align `FROM node:...` to `node:24.18.0-alpine3.24`
- [ ] `.docker/app/Dockerfile` — align both `FROM node:...` stages to `node:24.18.0-alpine3.24`
- [ ] Re-scan built `api`/`app` images after Dockerfile edit to confirm no new CVEs from the base bump
- [ ] `.github/workflows/quality.yml:13` — update `NODE_VERSION: '22'` → `'24'`
- [ ] `.github/workflows/security.yml:33` — update `node-version: '22'` → `'24'`
- [ ] `CLAUDE.md` — update "Node ≥ 20 required" → "Node ≥ 24 required"
- [ ] `api/package.json` — add `engines.node` (`>=24`)
- [ ] `app/package.json` — add `engines.node` (`>=24`)

## React 19 migration
- [ ] `app/package.json` — bump `react` and `react-dom` to `^19`
- [ ] `app/package.json` — bump `@types/react` and `@types/react-dom` to `^19`
- [ ] `app/package.json` — bump `eslint-plugin-react-hooks` 5→7 (enables React Compiler rules now that the version mismatch blocking this is resolved)
- [ ] `app/package.json` — bump `@vitejs/plugin-react` 4→6
- [ ] Run `docker compose exec app npm run lint` — triage any new findings from `eslint-plugin-react-hooks` v7's Compiler rules (31 unrelated pre-existing patterns were flagged when this was evaluated before — expect noise, scope down to real issues)
- [ ] Run `docker compose exec app npm test` — full suite, watch for `act()`-timing related failures from React 19's changed effect/cleanup scheduling
- [ ] Manual smoke test in browser: task CRUD, drag-and-drop (`@dnd-kit`), habit tracking, real-time sync — confirm no runtime regressions
- [ ] Optional: `app/src/components/monthly/MonthSelector.tsx` — simplify `forwardRef` + `useImperativeHandle` to plain ref-as-prop (React 19 feature, not required for correctness)

## Vulnerability sweep
- [ ] `api`: confirm clean — `docker compose exec api npm audit` (already verified 0 vulnerabilities as of 2026-07-23)
- [ ] `app`: `docker compose exec app npm audit fix` — resolves `brace-expansion` (GHSA-3jxr-9vmj-r5cp) and `fast-uri` (GHSA-v2hh-gcrm-f6hx), both dev-only transitive, both high severity
- [ ] `app`: re-run `npm audit` to confirm 0 vulnerabilities
- [ ] `app`: re-run `npm test` after the audit fix to confirm no transitive breakage
