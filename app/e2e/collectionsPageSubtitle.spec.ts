import { mkdir } from 'node:fs/promises';

import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('Collections index page does not display subtitle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/collections');
  await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible();

  await expect(page.getByText('Your projects at a glance')).not.toBeVisible();
  await expect(page.getByText('Seus projetos em um relance')).not.toBeVisible();

  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/collections-page-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Your projects at a glance')).not.toBeVisible();
  await expect(page.getByText('Seus projetos em um relance')).not.toBeVisible();

  await page.screenshot({ path: 'dist/screenshots/collections-page-mobile.png' });

  expect(errors).toEqual([]);
});
