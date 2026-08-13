import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "app",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
