import { mkdir } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { test } from './coverage-fixture';
import { STORAGE_STATE_PATH } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

const presets = [
  { id: 'nord-light', name: 'Nord Light', background: 'rgb(236, 239, 244)', chrome: '#eceff4', scheme: 'light' },
  { id: 'nord-dark', name: 'Nord Dark', background: 'rgb(46, 52, 64)', chrome: '#2e3440', scheme: 'dark' },
] as const;

async function chooseTheme(page: Page, name: string) {
  await page.goto('/settings/appearance');
  const radio = page.getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name, exact: true });
  const saved = page.waitForResponse(response => response.url().includes('/preferences') && response.request().method() === 'PATCH');
  await radio.click();
  expect((await saved).ok()).toBeTruthy();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
}

for (const preset of presets) {
  test(`${preset.name} persists, synchronizes between tabs, ignores OS changes and resets on logout`, async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/register');
    await page.locator('input[type="email"]').fill(`nord-${crypto.randomUUID()}@example.com`);
    await page.locator('input[type="password"]').fill('Correct-Horse-Battery-Staple-99!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(daily|today|inbox)/);
    await chooseTheme(page, 'Beige');
    const other = await context.newPage();
    await other.goto('/daily');
    await expect(other.locator('html')).toHaveAttribute('data-theme', 'beige');
    await chooseTheme(page, preset.name);
    await expect(other.locator('html')).toHaveAttribute('data-theme', preset.id);
    await expect(page.locator('body')).toHaveCSS('background-color', preset.background);
    await expect(page.locator('html')).toHaveCSS('color-scheme', preset.scheme);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', preset.chrome);
    await page.emulateMedia({ colorScheme: preset.scheme === 'dark' ? 'light' : 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', preset.id);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', preset.id);
    await other.close();
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 240, 232)');
  });
}

test('Nord menu choices persist and a failed save restores the previous palette', async ({ page }) => {
  await chooseTheme(page, 'Beige');
  await page.goto('/daily');
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const group = page.getByRole('menu').getByRole('radiogroup', { name: 'Theme' });
  await expect(group.getByRole('radio')).toHaveCount(5);
  for (const preset of presets) {
    const saved = page.waitForResponse(response => response.url().includes('/preferences') && response.request().method() === 'PATCH');
    await group.getByRole('radio', { name: preset.name, exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('data-theme', preset.id);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord-dark');
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.route('**/api/v1/preferences', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Try again' } }) })
    : route.continue());
  await group.getByRole('radio', { name: 'Nord Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord-dark');
  await expect(group.getByRole('radio', { name: 'Nord Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.unroute('**/api/v1/preferences');
  await chooseTheme(page, 'White');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'white');
  await chooseTheme(page, 'Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const preset of presets) {
  for (const width of [1440, 390]) {
    test(`${preset.name} renders pages and portal controls at ${width}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await chooseTheme(page, preset.name);
      await mkdir('dist/screenshots', { recursive: true });
      for (const route of ['daily/list', 'inbox', 'collections', 'habits', 'settings/appearance']) {
        await page.goto(`/${route}`);
        await expect(page.locator('html')).toHaveAttribute('data-theme', preset.id);
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('body')).toHaveCSS('background-color', preset.background);
        await page.evaluate(() => document.fonts.ready);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `dist/screenshots/${preset.id}-${route.replace('/', '-')}-${width}.png`, fullPage: true });
      }
      await expect(page.getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio')).toHaveCount(6);
      await page.goto('/daily');
      await page.getByRole('button', { name: 'More options', exact: true }).click();
      const group = page.getByRole('menu').getByRole('radiogroup', { name: 'Theme' });
      await expect(group.getByRole('radio')).toHaveCount(5);
      await group.getByRole('radio', { name: preset.name, exact: true }).focus();
      await expect(group.getByRole('radio', { name: preset.name, exact: true })).toBeFocused();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `dist/screenshots/${preset.id}-menu-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await page.locator('main').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('q');
      const dialog = page.getByRole('dialog', { name: 'Quick add task' });
      await expect(dialog).toBeVisible();
      const overlay = await dialog.locator('> div').evaluate(element => getComputedStyle(element).backgroundColor);
      expect(overlay).not.toBe('rgb(245, 240, 232)');
      await page.screenshot({ path: `dist/screenshots/${preset.id}-quick-add-${width}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}
