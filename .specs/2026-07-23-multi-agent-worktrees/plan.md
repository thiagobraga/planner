# Multi-Agent Git Worktree Support

## Strategy
Update the Docker Compose configuration to allow full isolation between different project instances running on the same host. This is crucial to allow multiple AI agents to work on separate features in different `git worktree` directories simultaneously without container name, port, or Traefik routing collisions.

## Approach
1. **Parameterize `compose.yml`**: Replace hardcoded container names (e.g. `planner-app`) with parameterized versions using the built-in Compose variable `COMPOSE_PROJECT_NAME` (e.g. `${COMPOSE_PROJECT_NAME:-planner}-app`).
2. **Dynamic Traefik Labels**: Update all Traefik router rules to use a parameterized subdomain (e.g. `Host(\`${APP_SUBDOMAIN:-planner}.local\`))`). Update all Traefik router and service names in labels to include `${COMPOSE_PROJECT_NAME:-planner}` to prevent router collisions in Traefik.
3. **Volume Isolation**: Ensure PostgreSQL and Redis volumes are scoped to the project (Docker Compose handles this automatically if volume names aren't marked as `external`, but we must ensure no hardcoded absolute host paths cause conflicts).
4. **Documentation**: Provide a clear guide on how agents should set up `.env` when creating a new worktree.

## Architecture Decisions
- Rely on Traefik for all routing rather than exposing host ports. This eliminates the need for dynamic port allocation and tracking.
- Fallbacks (`:-planner`) will be used everywhere to ensure the main repository continues to work out-of-the-box on `planner.local` without requiring new environment variables for standard usage.
