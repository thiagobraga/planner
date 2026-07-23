# Tasks

- [ ] Update `compose.yml` container names to use `${COMPOSE_PROJECT_NAME:-planner}`
- [ ] Update `compose.yml` Traefik router/service names to be prefixed with `${COMPOSE_PROJECT_NAME:-planner}`
- [ ] Update `compose.yml` Traefik `Host` rules to use `${APP_SUBDOMAIN:-planner}`
- [ ] Verify that default variables (`planner`) still serve the main branch correctly
- [ ] Verify that custom variables isolate instances correctly
- [ ] Document worktree initialization steps in `AGENTS.md` (or a dedicated `WORKTREES.md`)
