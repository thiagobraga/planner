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

### Requirements

- Docker
- Docker Compose

### Setup

```bash
cp .env.example .env          # fill POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB and CORS_ORIGIN
docker compose up -d          # installs deps, runs migrations, starts api (4000) and app (5173)
bash .hooks/setup-hooks.sh    # optional, one time: see Git hooks below
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Node 24 or later is only needed to run scripts outside Docker.

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

## Using the API from scripts and AI agents

Create a personal API token in **Settings > Integrations**. Choose _Read only_ or _Read & write_ and an expiry; the token (`plnr_...`) is shown once. Send it as a bearer header - no cookies or CSRF token needed:

```bash
curl -H "Authorization: Bearer plnr_xxxxxxxx" https://planner.local/api/v1/daily/2026-10-05/2026-10-11

curl -X POST -H "Authorization: Bearer plnr_xxxxxxxx" -H "Content-Type: application/json" \
  -d '{"title":"Call the dentist"}' https://planner.local/api/v1/tasks
```

Changes made with a token sync live to open tabs and are attributed to the token: Settings > Integrations lists recent agent activity (per token or across all of them), and an opt-in notice names the agent when it changes something while Planner is open. Read-only tokens get `403 INSUFFICIENT_SCOPE` on writes. Tokens cannot manage tokens or reach admin routes, and are revoked when you revoke them in Settings, reset your password, or an admin disables your account.

### Connect AI agents (MCP)

Planner exposes a [Model Context Protocol](https://modelcontextprotocol.io) server at `/api/v1/mcp`, so Claude Code, Claude Desktop, Cursor, VS Code and other MCP clients can read and manage your tasks. **Settings > Integrations** shows ready-to-paste setup; for Claude Code:

```bash
claude mcp add --transport http planner https://planner.local/api/v1/mcp \
  --header "Authorization: Bearer plnr_xxxxxxxx"
```

Reading tools (today, upcoming, inbox, collections, labels, search, filters, habits) are always available. A Read & write token adds tools to create, update, complete, move, reschedule and delete tasks, and to log habits. The full list is in **Settings > Integrations** and `api/src/mcp/tools/`. Dates like "next friday 3pm" are resolved by Planner in your timezone.

### Connect from claude.ai, ChatGPT and other hosted clients (OAuth)

Hosted MCP clients that can't take a pasted header sign in with OAuth instead. Add `https://<your-planner>/api/v1/mcp` as a custom connector. A Planner consent screen opens, and you choose read & write or read only. The app then appears under **Settings > Integrations > Connected apps**, where **Disconnect** cuts it off immediately.

Planner is its own OAuth 2.1 authorization server (PKCE S256, dynamic client registration, rotating refresh tokens). Discovery is served at `/.well-known/oauth-protected-resource/api/v1/mcp` and `/.well-known/oauth-authorization-server`. The issuer is `PUBLIC_BASE_URL`, which defaults to `CORS_ORIGIN`. The connector URL must be reachable over public HTTPS.

## CI workflows

Workflow files and names are numbered in the order work happens. Each job carries the workflow number plus a letter (`2b`, `4c`), so the Actions sidebar keeps the order.

| Workflow        | Runs on                                         | Does                                                                                                                                                                        |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.review.yml`  | PR to `main`                                    | 1a fails on high-severity dependency changes; 1b lints workflows with actionlint and zizmor                                                                                 |
| `2.ci.yml`      | PR and push to `main`, Monday schedule, by hand | 2a quality (`2a.quality.yml`: lint, tests, build, E2E), then 2b security (`2b.security.yml`: `npm audit`, CodeQL, secret scan, SBOM); on PRs also 2c container scan (Trivy) |
| `3.release.yml` | Push to `main`                                  | 3a release-please opens or updates the release PR; on merge it tags, 3b re-runs quality on the tagged commit, 3c calls deploy                                               |
| `4.deploy.yml`  | Called by 3, or run by hand from `main`         | 4a builds SHA images, 4b scans them, 4c moves `latest` and `vX.Y.Z`, 4d deploys to the VPS                                                                                  |

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
