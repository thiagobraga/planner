import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "app",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // e2e/*.spec.ts are Playwright suites, not vitest suites - keep them out.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
