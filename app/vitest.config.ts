import { defineProject } from "vitest/config";

// The HTML report is opt-in via `--reporter=html`: including the reporter in
// the config would generate it on every test run, but without it the CLI flag
// loses its `outputFile` option. Listing it only when the flag is present keeps
// both behaviors.
const htmlReportRequested =
  process.argv.includes("--reporter=html") ||
  (process.argv.includes("--reporter") && process.argv.includes("html"));

export default defineProject({
  test: {
    name: "app",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // e2e/*.spec.ts are Playwright suites, not vitest suites - keep them out.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    reporters: htmlReportRequested
      ? [["html", { outputFile: "./dist/html/index.html", open: false }]]
      : [],
  },
});
