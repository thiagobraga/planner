import { readFileSync } from 'node:fs';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version: string };

test.use({ storageState: STORAGE_STATE_PATH });

test('topbar shows the app version on desktop and hides it when space narrows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');
  const version = page.getByRole('banner').getByText(`v${pkg.version}`, { exact: true });
  await expect(version).toBeVisible();
  await page.setViewportSize({ width: 641, height: 900 });
  await expect(version).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(version).not.toBeVisible();
});
