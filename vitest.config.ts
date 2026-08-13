import { defineConfig } from "vitest/config";

// Unified root config — runs api + app tests in a single Vitest process
// so coverage is automatically merged across both projects.
export default defineConfig({
  test: {
    projects: ["api", "app"],
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
