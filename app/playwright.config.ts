import { defineConfig, devices } from '@playwright/test';

import { BASE_URL } from './e2e/fixtures/api';

// Coverage mode (test:e2e:coverage) serves the instrumented build via vite
// preview; the normal flow uses the configured app base URL.
const isCoverage = process.env.PLAYWRIGHT_COVERAGE === '1';
const baseURL =
  isCoverage
    ? process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173'
    : BASE_URL;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './e2e/playwright-report', open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
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
