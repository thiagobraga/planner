import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('displays dev label beside Planner in non-production app', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/daily');
  await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible();

  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();

  const devBadge = sidebar.locator('em', { hasText: 'dev' });
  await expect(devBadge).toBeVisible();

  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/sidebar-dev-label.png' });

  // Also capture close-up of logo and branding area
  const branding = sidebar.locator('.flex.items-start.gap-3').first();
  await branding.screenshot({ path: 'dist/screenshots/sidebar-dev-label-closeup.png' });

  expect(errors).toEqual([]);
});
