import { test as base, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

declare global {
  interface Window {
    __coverage__?: unknown;
  }
}

// E2E coverage collection. The app is served from a build instrumented by
// vite-plugin-istanbul, which populates `window.__coverage__` as code runs.
// Each test's snapshot is dumped to a JSON file and later merged into an HTML
// report by `e2e/merge-coverage.ts` (see the `test:e2e:coverage` script).
const rawDir = path.resolve(import.meta.dirname, "../coverage-e2e/raw");

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
    await use(page);
    if (process.env.PLAYWRIGHT_COVERAGE !== "1") return;
    const coverage = await page.evaluate(() => window.__coverage__).catch(() => undefined);
    if (!coverage) return;
    fs.mkdirSync(rawDir, { recursive: true });
    const slug = testInfo.testId.replace(/[^\w]+/g, "_");
    fs.writeFileSync(path.join(rawDir, `${slug}.json`), JSON.stringify(coverage));
  },
});
