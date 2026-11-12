import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('topbar shows development branding only while the full brand fits', async ({ page, api }) => {
  await api.patch('/preferences', { locale: 'en' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');
  const banner = page.getByRole('banner');
  await expect(banner.getByText('dev', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(banner.getByText('dev', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});
