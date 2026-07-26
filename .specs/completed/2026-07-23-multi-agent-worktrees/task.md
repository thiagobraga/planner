# Tasks

- [x] Update `compose.yml` container names to use `${COMPOSE_PROJECT_NAME:-planner}`
- [x] Update `compose.yml` Traefik router/service names to be prefixed with `${COMPOSE_PROJECT_NAME:-planner}`
- [x] Update `compose.yml` Traefik `Host` rules to use `${APP_SUBDOMAIN:-planner}`
- [x] Update `CORS_ORIGIN` default to derive from `APP_SUBDOMAIN`
- [x] Update `.env.example` with new optional worktree variables
- [x] Rewrite "Work on this spec" workflow in `AGENTS.md` with Compose isolation steps
- [x] Rewrite "Work on this spec" workflow in `CLAUDE.md` with Compose isolation steps
- [x] Rewrite "Work on this spec" workflow in `GEMINI.md` with Compose isolation steps
- [x] Add browser verification step to all agent workflows
- [x] Verify that default variables (`planner`) still serve the main branch correctly
- [x] Document worktree initialization steps in agent instruction files
