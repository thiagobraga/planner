# Node 24 + React 19 Upgrade

The runtime stack has drifted: Docker images already pin `node:26.5.0-alpine3.24`,
CI (`quality.yml`, `security.yml`) still pins Node **22**, and `CLAUDE.md` says
"Node ≥ 20 required." React is pinned to 18.3.1 while `@types/react` and every
React-consuming dependency (`@tanstack/react-query`, `react-router`, `zustand`,
`@dnd-kit/*`, `lucide-react`, `@testing-library/react`, `@vitejs/plugin-react`)
already declare React 19 support in their peer ranges — nothing blocks the bump
at the dependency level. This spec aligns the Node version everywhere, migrates
to React 19, and clears the two known high-severity vulnerabilities.

## Strategy

### 1. Node 24 alignment
**Decision: Node 24** (current LTS "krypton"), not the already-installed 26
(Current/unstable, not yet LTS as of 2026-07-23). Reconcile:
- Pin an exact tag, not `24`, `24-alpine`, or `latest`: `node:24.18.0-alpine3.24`
  (latest 24.x patch + latest supported Alpine base per `nodejs/docker-node`
  tag list as of 2026-07-23) — pin major.minor.patch + Alpine version so
  builds are reproducible and don't silently drift on rebuild
- Before locking the tag, scan it for vulnerabilities: `docker scout cves
  node:24.18.0-alpine3.24` (or `trivy image node:24.18.0-alpine3.24`); if
  high/critical CVEs with fixes exist, use the next patch tag instead.
  Re-scan the built `api`/`app` images after the Dockerfile edit to confirm
  no new findings from the base bump
- `.docker/api/Dockerfile`, `.docker/app/Dockerfile` — currently `26.5.0`, set both to `node:24.18.0-alpine3.24`
- `.github/workflows/quality.yml` (`NODE_VERSION: '22'`), `.github/workflows/security.yml` (`node-version: '22'`) — set to `'24'`
- `CLAUDE.md` "Node ≥ 20 required" line — update to "Node ≥ 24 required"
- Add an explicit `engines.node` field (`>=24`) to both `api/package.json` and `app/package.json` (currently absent) so the requirement is enforced, not just documented

### 2. React 19 migration
Dependency-compat check already done — no blockers found. Remaining work:
- Bump `react`, `react-dom` to `^19`, `@types/react`/`@types/react-dom` to `^19` in `app/package.json`
- Bump `eslint-plugin-react-hooks` 5→7 now that the React 19 target makes its React Compiler rules relevant (previously deferred in `.specs/completed/2026-07-22-production-deployment` specifically because the project was still on React 18/mismatched versions)
- Bump `@vitejs/plugin-react` 4→6 (peer range already covers current `vite`)
- Codebase scan already done: no `ReactDOM.render`, no `propTypes`, no string refs — already on `createRoot`. One production `forwardRef` + `useImperativeHandle` usage (`app/src/components/monthly/MonthSelector.tsx`) — still valid in React 19, optional cleanup to plain ref-as-prop, not required
- Run full app test suite + manual smoke test after the bump (React 19 changes effect timing/cleanup semantics in edge cases `act()`-wrapped tests can miss)

### 3. Vulnerability sweep
- `api`: `npm audit` — 0 vulnerabilities, no action
- `app`: `npm audit` — 2 high, both transitive dev-only, both `fixAvailable: true`:
  - `brace-expansion` (GHSA-3jxr-9vmj-r5cp, ReDoS) — range `<1.1.16`
  - `fast-uri` (GHSA-v2hh-gcrm-f6hx, host confusion) — range `3.0.0–3.1.3`
  - Run `npm audit fix` in `app/`, then re-run `npm audit` to confirm clean and `npm test` to confirm no breakage from transitive bumps
