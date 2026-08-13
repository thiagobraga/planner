import { defineConfig } from "vitest/config";

// Defaults let vitest run from the host (VSCode extension, no shell env)
// against the docker-published postgres/redis. The ??= never overrides the
// container's own DATABASE_URL/REDIS_URL (which use the `postgres`/`redis`
// service hostnames), so in-container runs are unchanged.
process.env.DATABASE_URL ??= "postgres://planner:planner@localhost:5432/planner";
process.env.REDIS_URL ??= "redis://:planner@localhost:6379";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./vitest-coverage",
    },
  },
});
