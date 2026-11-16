import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version: string };
const rootChangelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf-8');
const topReleases = [...rootChangelog.matchAll(/^## \[([^\]]+)\]\(([^)]+)\) \((\d{4}-\d{2}-\d{2})\)/gm)].map(
  (match) => ({ version: match[1], href: match[2], date: match[3] }),
);
const latestRelease = topReleases[0];

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
  await expect(releaseHeadings.first()).toContainText(latestRelease.version);
  await expect(releaseHeadings.first()).toContainText(latestRelease.date);

  const compareLink = page.getByRole('main').getByRole('link', { name: latestRelease.version, exact: true });
  await expect(compareLink).toHaveAttribute('href', latestRelease.href);
  await expect(compareLink).toHaveAttribute('rel', 'noopener noreferrer');

  await expect(page.locator('.changelog-page h3').first()).toBeVisible();
  await expect(page.locator('.changelog-page li').first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.screenshot({ path: 'dist/screenshots/changelog-desktop.png', fullPage: false });

  // Scrolling stays pinned seamlessly without premature gaps before the next release arrives.
  const stickyMetrics = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const h1 = document.querySelector('.changelog-page h1')!;
    const [v0, v1, v2] = [...document.querySelectorAll('.changelog-page h2')];

    const h1TopRect = h1.getBoundingClientRect();
    const v0TopRect = v0.getBoundingClientRect();
    const v1TopRect = v1.getBoundingClientRect();
    const v2TopRect = v2.getBoundingClientRect();

    const startPin = v0TopRect.top - h1TopRect.bottom;
    const startHandoff = v1TopRect.top - h1TopRect.bottom - v0TopRect.height;

    main.scrollTop = Math.round((startPin + startHandoff) / 2);
    const pinnedBeforeNext = {
      h1Bottom: h1.getBoundingClientRect().bottom,
      v0Top: v0.getBoundingClientRect().top,
    };

    main.scrollTop = Math.round(startHandoff + Math.min(12, v0TopRect.height / 2));
    const handoff = {
      v0Bottom: v0.getBoundingClientRect().bottom,
      v1Top: v1.getBoundingClientRect().top,
    };

    main.scrollTop = Math.round(v2TopRect.top - h1TopRect.bottom + 24);
    const h1Rect = h1.getBoundingClientRect();
    const vRect = v2.getBoundingClientRect();
    return {
      pinnedBeforeNext,
      handoff,
      h1Bottom: h1Rect.bottom,
      vTop: vRect.top,
      mainTop: main.getBoundingClientRect().top,
    };
  });
  expect(stickyMetrics.pinnedBeforeNext.v0Top).toBe(stickyMetrics.pinnedBeforeNext.h1Bottom);
  expect(Math.abs(stickyMetrics.handoff.v1Top - stickyMetrics.handoff.v0Bottom)).toBeLessThanOrEqual(1);
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
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(latestRelease.version);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.screenshot({ path: 'dist/screenshots/changelog-mobile-390.png', fullPage: false });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
