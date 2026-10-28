import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('sidebar icons keep their geometry when collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/v1/auth/me', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, user: { ...data.user, role: 'admin' } } });
  });
  await page.goto('/daily');
  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('link', { name: /Daily|Diário/ })).toBeVisible();
  const geometry = () => sidebar.locator('a[href]:not([href="#"]) svg').evaluateAll((icons) =>
    icons.map((icon) => {
      const { x, y, width, height } = icon.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  const expanded = await geometry();
  const versionRow = sidebar.locator('.sidebar-version-row');
  const expandedVersionRow = await versionRow.boundingBox();
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/sidebar-aligned-expanded.png' });
  await sidebar.getByRole('button', { name: /Collapse sidebar|Ocultar barra|Recolher barra/ }).click();
  await expect(sidebar).toHaveClass(/sidebar-collapsed/);
  expect(await geometry()).toEqual(expanded);
  expect((await sidebar.boundingBox())?.width).toBe(64);
  await expect(sidebar.locator('.sidebar-header img')).toHaveAttribute('width', '16');
  const compactVersionRow = await versionRow.boundingBox();
  expect(compactVersionRow?.y).toBe(expandedVersionRow?.y);
  expect(compactVersionRow?.height).toBe(expandedVersionRow?.height);
  const badge = await sidebar.locator('.sidebar-version').boundingBox();
  expect(badge!.x + badge!.width / 2).toBeCloseTo(31.5, 0);
  await expect(sidebar.getByText('Daily', { exact: true })).not.toBeVisible();
  await page.screenshot({ path: 'dist/screenshots/sidebar-aligned-collapsed.png' });
  await sidebar.getByRole('button', { name: /Expand sidebar|Expandir barra/ }).click();
  expect(await geometry()).toEqual(expanded);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  await page.screenshot({ path: 'dist/screenshots/sidebar-aligned-mobile.png' });
  expect(errors).toEqual([]);
});
