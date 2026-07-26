# CI Trigger Optimization — Ignore Non-Production Path Changes

## Strategy

Prevent unnecessary GitHub Actions CI workflow triggers when changes do not affect production application code or build artifacts.

### Ignored Paths

- `**.md` — Documentation, README, agent instructions (AGENTS.md, CLAUDE.md, DESIGN.md, GEMINI.md), specs markdown files
- `.specs/**` — Specs planning and task tracking files
- `.claude/**` and `.claudeignore` — Claude agent configuration and state
- `.superpowers/**` — Superpowers tools and scripts
- `.omx/**` — OpenModeX agent logs and session state
- `.vscode/**` — Editor workspace settings
- `.codegraph/**` — CodeGraph indexes
- `backups/**` — Local backup files
- `.gitignore` — Git ignore specification

### Target File

- `.github/workflows/pipeline.yml` — Add `paths-ignore` filters under `on.push` and `on.pull_request`.
