<h1 align="center">
  <img src="app/public/images/bulletjournal-planner-192x192.png" alt="Planner" width="96">
  <br>
  Planner
</h1>

<p align="center">
  Beautiful and easy-to-use Bullet Journal task management
</p>

<p align="center">
  <img src="https://img.shields.io/badge/%E2%80%8B-React-f5f0e8?style=flat&logoColor=f5f0e8&logo=react" alt="React">
  <img src="https://img.shields.io/badge/%E2%80%8B-TypeScript-f5f0e8?style=flat&logo=typescript&logoColor=f5f0e8" alt="TypeScript">
  <img src="https://img.shields.io/badge/%E2%80%8B-Tailwind-f5f0e8?style=flat&logoColor=f5f0e8&logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/%E2%80%8B-Vite-f5f0e8?style=flat&logoColor=f5f0e8&logo=vite" alt="Vite">
  <br>
  <img src="https://img.shields.io/badge/%E2%80%8B-Docker-f5f0e8?style=flat&logoColor=f5f0e8&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/%E2%80%8B-PostgreSQL-f5f0e8?style=flat&logoColor=f5f0e8&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/license-MIT-f5f0e8?style=flat" alt="MIT License" />
  <br>
  <img src="https://github.com/thiagobraga/planner/actions/workflows/pipeline.yml/badge.svg" alt="Pipeline badge" />
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/thiagobraga/planner?style=social" alt="Github repository stars" />
</p>

## About

Planner is a minimalist Bullet Journal-inspired task manager designed to help you organize your tasks with focus and clarity.

It supports daily planning, monthly organization, habit tracking, collections, tags and filters through a clean and distraction-free interface.

## Features

- **Daily, Monthly, and Habits Views**: Flexible layouts to manage tasks, schedule events, and log habit completions.
- **Collections, Tags, and Filters**: Rich hierarchical collection trees and flexible classification rules.
- **PWA (Progressive Web App) Support**: Fully installable on Desktop, iOS, and Android devices. Custom launch configurations and optimized asset precaching.
- **Offline Mode & Local-First Flow**: Browse the app shell and cached data offline, and seamlessly queue writes (POST, PATCH, PUT, DELETE) inside an IndexedDB-backed mutation store.
- **Background Sync & ID Remapping**: Automatically replays queued offline operations in strict FIFO order on reconnection. Automatically resolves client-minted temporary IDs with server-assigned IDs to prevent desyncing subsequent modifications.
- **Debounced Connectivity Indicator**: Small, non-intrusive network status pill with a debounced delay to prevent flashing and a sleek glassmorphic blur style.
- **Real-Time WebSockets**: Live synchronizations across tabs and devices via Socket.IO.
- **List and Kanban Visualizations**: Multiple ways to visualize your workspace.
- **Modern Routing Architecture**: Built on React Router v7 with declarative Splat path configuration.

## Installation

### Requirements

- Docker
- Docker Compose

### Setup

```bash
cp .env.example .env
docker compose up -d
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```text
planner/
├── api/
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── db/
│   └── package.json
├── app/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── api/
│   │   └── utils/
│   └── package.json
├── docs/
└── compose.yml
```

## Architecture

See [DESIGN.md](./DESIGN.md) for detailed design system specification, component library, and visual guidelines. Data flow, service architecture, and real-time sync mechanisms documented in [CLAUDE.md](./CLAUDE.md).

## Testing & Coverage

Two coverage reports are browsable on the coverage host — the Vitest report at
`https://coverage.planner.local` (root) and the Playwright e2e report at
`https://coverage.planner.local/e2e/`. Both are served by a static nginx
container from `app/coverage-reports/` (kept outside `dist/` so app builds
never wipe them):

```bash
docker compose up -d                                    # includes the coverage container
docker compose exec app npx vitest run --reporter=html  # Vitest report (coverage-reports/)
docker compose exec app npm run test:e2e:coverage       # E2E report (coverage-reports/e2e/)
```

### E2E coverage (Playwright)

`test:e2e:coverage` builds the app with istanbul instrumentation
(`VITE_COVERAGE=true`), runs Playwright against a `vite preview` server
(auto-started on port 4173), collects a `window.__coverage__` snapshot after
each test into `coverage-e2e/raw/`, and merges them into `coverage-reports/e2e/`.
Coverage is opt-in — plain `npm run test:e2e` stays unchanged and
un-instrumented. (Note: only frontend code is covered; API routes hit during
e2e are not counted.)

### Prerequisites

- The `coverage.planner.local` entry in `/etc/hosts` (TLS is provided by Traefik and is pre-configured for this host). In isolated worktree stacks the host is `coverage.<agent>.planner.local`, e.g. `coverage.claude.planner.local`.
- The Vitest HTML reporter is opt-in: it is only generated when `--reporter=html` is passed (see `app/vitest.config.ts`); the Playwright report is generated only by `test:e2e:coverage`.
- Both reports are served from `app/coverage-reports/` — the nginx bind mount stays valid across regenerations (only file contents change, never the directory itself).

## Contributing

Contributions are welcome.

### Git hooks

Optional but recommended — they run the same checks CI does, so a red
pipeline shows up locally instead of on GitHub. Enable once per clone:

```bash
./.hooks/setup-hooks.sh     # sets core.hooksPath to .hooks/
```

| Hook       | Runs                    | Typical time |
| ---------- | ----------------------- | ------------ |
| pre-commit | `lint`                  | 2–8s         |
| pre-push   | `lint`, `test`, `build` | ~30s/package |

Both only check the packages your change actually touches, so a docs-only
commit does no work and an `api/` change never waits on the app suite.
Commands run natively when `node_modules` is present, otherwise through the
running compose service; with neither available they warn and skip rather
than blocking you.

Bypass a single run with `--no-verify`, or `export SKIP_HOOKS=1` for a
session. Disable entirely with `git config --unset core.hooksPath`.

### Workflow

1. Fork the repository.
2. Create a branch:

```bash
git checkout -b feature/my-feature
```

3. Commit your changes:

```bash
git commit -m "feat: add my feature"
```

4. Push the branch:

```bash
git push origin feature/my-feature
```

5. Open a pull request.

## License

This project is licensed under the [MIT License](./LICENSE).
