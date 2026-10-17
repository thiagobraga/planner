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
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        settings: {
          // Tests never read stylesheet bytes. Left on, happy-dom fetches every
          // <link rel="stylesheet"> href for real (fontLoader.test.ts hits
          // fonts.googleapis.com) and logs the aborted requests at teardown.
          // "As success" makes the link report load instead of logging a
          // NotSupportedError for each skipped fetch.
          disableCSSFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    globals: true,
    globalSetup: ["./src/test/globalSetup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // e2e/*.spec.ts are Playwright suites, not vitest suites - keep them out.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    reporters: htmlReportRequested
      ? [["html", { outputFile: "./coverage-reports/index.html", open: false }]]
      : ["default"],
  },
});
