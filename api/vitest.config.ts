import { defineProject } from "vitest/config";

// Defaults let vitest run from the host (VSCode extension, no shell env)
// against the docker-published postgres/redis. The ??= never overrides the
// container's own DATABASE_URL/REDIS_URL (which use the `postgres`/`redis`
// service hostnames), so in-container runs are unchanged.
const defaultDbUser = process.env.POSTGRES_USER ?? "planner";
const defaultDbPassword = process.env.POSTGRES_PASSWORD ?? "planner";
process.env.DATABASE_URL ??= `postgres://${defaultDbUser}:${defaultDbPassword}@localhost:5432/planner_test`;
process.env.REDIS_URL ??= `redis://:${process.env.REDIS_PASSWORD ?? "planner"}@localhost:6379`;

export default defineProject({
  test: {
    name: "api",
    exclude: ["dist/**", "node_modules/**"],
    globals: false,
    environment: "node",
  },
});
