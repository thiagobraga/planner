import { defineConfig } from "vitest/config";

// Unified root config merges coverage across all three packages.
export default defineConfig({
  test: {
    projects: ["api", "app", "site"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./vitest-coverage",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
