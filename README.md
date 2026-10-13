<h1 align="center">
  <img src="app/public/images/logo/logo-128x128.png" alt="Planner" width="96">
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
  <img src="https://github.com/thiagobraga/planner/actions/workflows/2.ci.yml/badge.svg" alt="CI badge" />
  <img src="https://github.com/thiagobraga/planner/actions/workflows/3.release.yml/badge.svg?branch=main" alt="Release and deploy badge" />
  <img src="https://img.shields.io/github/stars/thiagobraga/planner?style=social" alt="GitHub repository stars" />
</p>

## About

Planner is a minimalist task manager inspired by the Bullet Journal. It supports daily planning, monthly organization, habit tracking, collections, tags and filters through a clean, distraction-free interface.

The design system is in [DESIGN.md](./DESIGN.md). Data flow, services and real-time sync are in [CLAUDE.md](./CLAUDE.md).

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

- Requires Docker and Docker Compose. Node 24+ is only needed outside Docker.
- Copy the env file and fill `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `CORS_ORIGIN`:

  ```bash
  cp .env.example .env
  ```

- Start the stack (installs deps, runs migrations, serves api on 4000 and app on 5173):

  ```bash
  docker compose up -d
  ```

- Open [http://localhost:5173](http://localhost:5173).
- Optional, once per clone: `bash .hooks/setup-hooks.sh` (see [Git hooks](#git-hooks)).

### Production deployment

Production uses `compose.prod.yml` for the shared PostgreSQL, Redis, and nginx router services. `compose.prod.color.yml` starts the app, API, and one-shot migration in separate blue and green Compose projects. The router stays on `127.0.0.1:8080` while the deploy script prepares the inactive color, checks it, switches nginx, and verifies both public app and API responses before stopping the old color.

GitHub Actions runs `scripts/blue-green-deploy.sh <commit-sha>` after building and scanning the SHA-tagged images. For a manual deployment from the production checkout, set `CORS_ORIGIN=https://planner.thiagobraga.dev` and run the same script with a published 40-character commit SHA. The script serializes runs with `flock`. Runtime state is kept in `deploy/.active-color`, `deploy/.active-image`, `deploy/.previous-image`, and `deploy/00-upstreams.conf`; these files are ignored by Git and must be preserved between deploys.

To roll back after a completed switch, run the script with the previous image SHA:

```bash
export CORS_ORIGIN=https://planner.thiagobraga.dev
bash scripts/blue-green-deploy.sh "$(cat deploy/.previous-image)"
```

The first rollout from the legacy single-app stack briefly releases port 8080 before the router can bind it, so a short 502 window is unavoidable on that bootstrap with the host nginx configuration unchanged. Later rollouts keep the router bound. Migrations must remain backward-compatible because the old API serves while the new color migrates and starts. A failed switch restores the old router target before the old color is stopped. Do not use `docker compose down -v` for deployment or rollback.

## Project Structure

```
📁 planner/
├── 📁 api/                          # Express + PostgreSQL + Redis backend
│   └── 📁 src/
│       ├── 📁 db/                   # connection pool, Redis clients, SQL migrations (run at startup)
│       ├── 📁 engines/              # recurrence rules (daily, weekly, monthly, yearly)
│       ├── 📁 mcp/                  # MCP server and tools for AI agents
│       ├── 📁 middleware/           # auth (session or token), CSRF, scopes, error handler
│       ├── 📁 oauth/                # OAuth 2.1 provider for hosted MCP clients
│       ├── 📁 parsers/              # Peggy grammars for the filter language and dates
│       ├── 📁 routes/               # HTTP controllers, one file per resource under /api/v1
│       ├── 📁 services/             # business logic and SQL; syncService broadcasts real-time events
│       ├── 📁 types/                # shared TypeScript types
│       └── 📁 utils/                # small helpers such as AppError
├── 📁 app/                          # React + Vite frontend (installable PWA)
│   ├── 📁 e2e/                      # Playwright end-to-end tests
│   ├── 📁 public/                   # icons, splash screens, web manifest
│   └── 📁 src/
│       ├── 📁 api/                  # fetch client and React Query setup
│       ├── 📁 components/           # UI pieces: board, daily, dnd, habits, monthly, settings, ui
│       ├── 📁 contexts/             # AuthContext: login state and socket lifecycle
│       ├── 📁 hooks/                # useSync (real-time), drag and drop, preferences, shortcuts
│       ├── 📁 i18n/                 # translations
│       ├── 📁 pages/                # one component per route; admin/ holds admin screens
│       ├── 📁 stores/               # Zustand stores and optimistic update helpers
│       ├── 📁 types/                # shared TypeScript types
│       └── 📁 utils/                # socket singleton, date ranges, small helpers
├── 📁 .docker/                      # Dockerfiles, entrypoints, nginx, Redis and pgAdmin config
├── 📁 .github/
│   ├── 📁 workflows/                # numbered CI, release and deploy pipelines
│   └── 📄 dependabot.yml            # weekly dependency updates
├── 📁 .claude/                      # Claude Code agents, commands and skills for this repo
├── 📁 .hooks/                       # versioned git hooks (pre-commit, pre-push)
├── 📁 .specs/                       # feature specs: plan.md (what) and task.md (how) per change
├── 📄 CLAUDE.md                     # rules for AI agents; AGENTS.md, GEMINI.md and copilot-instructions.md symlink to it
├── 📄 DESIGN.md                     # design system: palette, typography, spacing
├── 📄 compose.yml                   # dev stack: api, app, Postgres, Redis, pgAdmin
├── 📄 compose.prod.yml              # production stack, images from GHCR
├── 📄 release-config.json           # release-please settings
├── 📄 .release-manifest.json        # last released version, kept by release-please
├── 📄 CHANGELOG.md                  # generated by release-please
├── 📄 .env.example                  # required environment variables
└── 📄 README.md
```

## MCP Server

Planner has an [MCP](https://modelcontextprotocol.io) server at `/api/v1/mcp` for Claude Code, Claude Desktop, Cursor, VS Code and other clients. It uses the same personal API tokens as the REST API.

### API token

- Create one in **Settings > Integrations**: _Read only_ or _Read & write_, plus an expiry. The token (`plnr_...`) is shown once.
- Send it as `Authorization: Bearer plnr_...`. No cookies or CSRF token needed.
- Read-only tokens get `403 INSUFFICIENT_SCOPE` on writes. Tokens cannot reach token management or admin routes.
- Changes made with a token sync live and are attributed to it. Settings > Integrations lists recent agent activity.
- Tokens stop working when you revoke them, reset your password, or an admin disables your account.

```bash
curl -H "Authorization: Bearer plnr_xxxxxxxx" https://planner.local/api/v1/daily/2026-10-05/2026-10-11
```

### Connect an agent

```bash
claude mcp add --transport http planner https://planner.local/api/v1/mcp \
  --header "Authorization: Bearer plnr_xxxxxxxx"
```

- Read tools (today, upcoming, inbox, collections, labels, search, filters, habits) are always on.
- A Read & write token adds create, update, complete, move, reschedule, delete and habit logging.
- Full list and ready-to-paste setups: **Settings > Integrations** and `api/src/mcp/tools/`.
- Dates like "next friday 3pm" are resolved in your timezone.

### Hosted clients (claude.ai, ChatGPT)

- Add `https://<your-planner>/api/v1/mcp` as a custom connector, then approve on the Planner consent screen (read & write or read only).
- Manage or **Disconnect** the app under **Settings > Integrations > Connected apps**.
- Planner is its own OAuth 2.1 server (PKCE S256, dynamic client registration, rotating refresh tokens). The issuer is `PUBLIC_BASE_URL`, default `CORS_ORIGIN`, and it must be public HTTPS.

## CI workflows

Workflow files and names are numbered in the order work happens. Each job carries the workflow number plus a letter (`2b`, `4c`), so the Actions sidebar keeps the order.

| Workflow        | Runs on                                         | Does                                                                                                                                                                        |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.review.yml`  | PR to `main`                                    | 1a fails on high-severity dependency changes; 1b lints workflows with actionlint and zizmor                                                                                 |
| `2.ci.yml`      | PR and push to `main`, Monday schedule, by hand | 2a quality (`2a.quality.yml`: lint, tests, build, E2E), then 2b security (`2b.security.yml`: `npm audit`, CodeQL, secret scan, SBOM); on PRs also 2c container scan (Trivy) |
| `3.release.yml` | Push to `main`                                  | 3a release-please opens or updates the release PR; on merge it tags, 3b re-runs quality on the tagged commit, 3c calls deploy                                               |
| `4.deploy.yml`  | Called by 3, or run by hand from `main`         | 4a validates blue/green scripts and Compose; 4b builds SHA images, 4c scans them, 4d moves `latest` and `vX.Y.Z`, 4e deploys to the VPS                                    |

- Deploy only follows a release merge and only runs from `main`. A manual run from another branch skips every job.
- Deploy runs in the `production` environment. Adding a required reviewer there makes it wait for approval.
- Actions are pinned to commit SHAs (Dependabot keeps them current), workflows default to no permissions, and every job has a timeout.
- PRs read the Docker cache but never write it. Only deploy writes it.

## Releases

Versions follow [SemVer](https://semver.org/) and tags are `vX.Y.Z`. [release-please](https://github.com/googleapis/release-please) reads Conventional Commits on `main` and keeps one release PR open.

| Commit                                          | Bump                            |
| ----------------------------------------------- | ------------------------------- |
| `fix:`                                          | patch                           |
| `feat:`                                         | minor                           |
| `feat!:` or `BREAKING CHANGE:` footer           | major (minor while below 1.0.0) |
| `docs`, `style`, `test`, `chore`, `ci`, `build` | none, hidden from the changelog |

To cut a release, merge the release PR. It bumps the version, updates `CHANGELOG.md`, tags `vX.Y.Z` and deploys (see [CI workflows](#ci-workflows)). Plain pushes to `main` do not deploy.

PRs opened by `GITHUB_TOKEN` do not trigger CI. Set the `RELEASE_PLEASE_TOKEN` secret (a PAT or app token) so CI runs on the release PR.

The release version is unrelated to `BUILD_ID` / `/api/v1/version`, which only detect a new deploy for the "update available" toast.

## Testing & Coverage

Two coverage reports are browsable on the coverage host: the Vitest report at `https://coverage.planner.local` and the Playwright E2E report at `https://coverage.planner.local/e2e/`. Both are served by a static nginx container from `app/coverage-reports/`, which sits outside `dist/` so app builds never wipe it.

Prerequisites:

- The `coverage.planner.local` entry in `/etc/hosts`. TLS is provided by Traefik and is pre-configured for this host. In isolated worktree stacks the host is `coverage.<agent>.planner.local`, for example `coverage.claude.planner.local`.

```bash
docker compose up -d                                    # includes the coverage container
docker compose exec app npx vitest run --reporter=html  # Vitest report (coverage-reports/)
docker compose exec app npm run test:e2e:coverage       # E2E report (coverage-reports/e2e/)
```

`test:e2e:coverage` builds the app with istanbul instrumentation (`VITE_COVERAGE=true`), runs Playwright against a `vite preview` server on port 4173, collects a `window.__coverage__` snapshot after each test into `coverage-e2e/raw/`, and merges them into `coverage-reports/e2e/`. Coverage is opt-in: plain `npm run test:e2e` stays un-instrumented. Only frontend code is covered; API routes hit during E2E are not counted.

## Contributing

Contributions are welcome. Use [Conventional Commits](https://www.conventionalcommits.org/) for commits and branch names (`feat/`, `fix/`, `chore/`, `docs/`, ...), because release-please builds the changelog and version bumps from them.

### Git hooks

Optional but recommended: they run the same checks CI does, so a red pipeline shows up locally instead of on GitHub. Enable once per clone:

```bash
bash .hooks/setup-hooks.sh     # sets core.hooksPath to .hooks/
```

| Hook       | Runs                    |
| ---------- | ----------------------- |
| pre-commit | `lint`                  |
| pre-push   | `lint`, `test`, `build` |

Both only check the packages your change touches, so a docs-only commit does no work and an `api/` change never waits on the app suite. Commands run natively when `node_modules` is present, otherwise through the running compose service. With neither available they warn and skip instead of blocking you.

Bypass a single run with `--no-verify`, or `export SKIP_HOOKS=1` for a session. Disable entirely with `git config --unset core.hooksPath`.

### Workflow

1. Fork the repository.
2. Create a branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push the branch: `git push origin feat/my-feature`
5. Open a pull request.

## License

This project is licensed under the [MIT License](./LICENSE).
