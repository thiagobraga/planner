import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
) as { version: string };

test.use({ storageState: STORAGE_STATE_PATH });

test('displays current app version in expanded and collapsed sidebar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/daily');
  await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible();

  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();

  const versionText = `v${pkg.version}`;
  const versionLocator = sidebar.getByText(versionText, { exact: true });
  await expect(versionLocator).toBeVisible();
  await expect(versionLocator).toHaveAttribute(
    'title',
    new RegExp(`^(Version|Versão) ${pkg.version.replaceAll('.', '\\.')}$`),
  );

  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/sidebar-version.png' });

  const collapseButton = sidebar.getByRole('button', {
    name: /Collapse sidebar|Recolher barra lateral/i,
  });
  await collapseButton.click();

  const collapsedSidebar = page.locator('aside.sidebar-collapsed');
  await expect(collapsedSidebar).toBeVisible();

  const collapsedVersionLocator = collapsedSidebar.getByText(versionText, { exact: true });
  await expect(collapsedVersionLocator).toBeVisible();
  await expect(collapsedVersionLocator).toHaveAttribute(
    'title',
    new RegExp(`^(Version|Versão) ${pkg.version.replaceAll('.', '\\.')}$`),
  );

  await page.screenshot({ path: 'dist/screenshots/sidebar-version-collapsed.png' });

  expect(errors).toEqual([]);
});
