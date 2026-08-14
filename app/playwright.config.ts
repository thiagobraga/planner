import { defineConfig, devices } from '@playwright/test';

// Coverage mode (test:e2e:coverage) serves the instrumented build via vite
// preview; the normal flow keeps targeting the dev server on 5173.
const isCoverage = process.env.PLAYWRIGHT_COVERAGE === '1';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || (isCoverage ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  ...(isCoverage
    ? {
        webServer: {
          command: 'npx vite preview --port 4173 --strictPort --host',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }
    : {}),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
