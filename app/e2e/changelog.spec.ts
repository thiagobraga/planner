import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version: string };

test.use({ storageState: STORAGE_STATE_PATH });

test.beforeEach(async ({ api }) => {
  await api.patch('/preferences', { locale: 'en', navStyle: 'icon-left', background: 'beige' });
});

test('desktop topbar version opens /changelog and renders release history cleanly', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await mkdir('dist/screenshots', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');

  const versionLink = page.getByRole('banner').getByRole('link', {
    name: `What's new on v${pkg.version}`,
  });
  await expect(versionLink).toBeVisible();
  await expect(versionLink).toHaveText(`v${pkg.version}`);
  await versionLink.click();

  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();

  const releaseHeadings = page.getByRole('heading', { level: 2 });
  await expect(releaseHeadings.first()).toContainText('0.19.2');
  await expect(releaseHeadings.first()).toContainText('2026-11-14');

  const compareLink = page.getByRole('main').getByRole('link', { name: '0.19.2', exact: true });
  await expect(compareLink).toHaveAttribute('href', 'https://github.com/thiagobraga/planner/compare/v0.19.1...v0.19.2');
  await expect(compareLink).toHaveAttribute('rel', 'noopener noreferrer');

  await expect(page.getByRole('heading', { level: 3, name: 'Fixed' }).first()).toBeVisible();
  await expect(page.getByText(/preserve collection task ordering/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.screenshot({ path: 'dist/screenshots/changelog-desktop.png', fullPage: false });

  // Scrolling stays pinned seamlessly without premature gaps before the next release arrives.
  const stickyMetrics = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const h1 = document.querySelector('.changelog-page h1')!;
    const h2s = [...document.querySelectorAll('.changelog-page h2')];
    const v0192 = h2s.find((el) => el.textContent?.includes('0.19.2'))!;
    const v0191 = h2s.find((el) => el.textContent?.includes('0.19.1'))!;
    const v0190 = h2s.find((el) => el.textContent?.includes('0.19.0'))!;

    main.scrollTop = 120;
    const pinnedBeforeNext = {
      h1Bottom: h1.getBoundingClientRect().bottom,
      v0192Top: v0192.getBoundingClientRect().top,
    };

    main.scrollTop = 156;
    const handoff = {
      v0192Bottom: v0192.getBoundingClientRect().bottom,
      v0191Top: v0191.getBoundingClientRect().top,
    };

    main.scrollTop = 450;
    const h1Rect = h1.getBoundingClientRect();
    const vRect = v0190.getBoundingClientRect();
    return {
      pinnedBeforeNext,
      handoff,
      h1Bottom: h1Rect.bottom,
      vTop: vRect.top,
      mainTop: main.getBoundingClientRect().top,
    };
  });
  expect(stickyMetrics.pinnedBeforeNext.v0192Top).toBe(stickyMetrics.pinnedBeforeNext.h1Bottom);
  expect(stickyMetrics.handoff.v0191Top).toBe(stickyMetrics.handoff.v0192Bottom);
  expect(stickyMetrics.vTop).toBe(stickyMetrics.h1Bottom);
  expect(stickyMetrics.vTop - stickyMetrics.mainTop).toBe(48);
  await page.evaluate(() => {
    document.querySelector('main')!.scrollTop = 0;
  });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('desktop topbar version supports keyboard activation with Enter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');

  const versionLink = page.getByRole('banner').getByRole('link', {
    name: `What's new on v${pkg.version}`,
  });
  await versionLink.focus();
  await expect(versionLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
});

test('mobile planner-menu version opens /changelog in a single readable column', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await mkdir('dist/screenshots', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');

  await page.getByRole('button', { name: 'Planner menu', exact: true }).click();
  const menu = page.getByRole('menu');
  const menuVersion = menu.getByRole('link', {
    name: `What's new on v${pkg.version}`,
  });
  await expect(menuVersion).toBeVisible();
  await expect(menuVersion).toHaveText(`v${pkg.version}`);
  await menuVersion.click();

  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText('0.19.2');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.screenshot({ path: 'dist/screenshots/changelog-mobile-390.png', fullPage: false });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
