import { expect, type Page } from '@playwright/test';
import { test } from './coverage-fixture';

/** Covers the Settings theme picker: dark, automatic (OS scheme), persistence, and logged-out screens. */

const DARK_PAGE_BG = 'rgb(41, 34, 25)';
const DARK_OVERLAY_BG = 'rgb(47, 39, 30)';
const BEIGE_PAGE_BG = 'rgb(245, 240, 232)';

async function registerAndLogin(page: Page) {
  const email = `e2e-dark-theme-${Date.now()}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  await page.goto('/register');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });
}

function bodyBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function chooseTheme(page: Page, name: 'Beige' | 'White' | 'Dark' | 'Automatic') {
  await page.goto('/settings/appearance');
  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' });
  const option = themeGroup.getByRole('radio', { name, exact: true });
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
}

test.describe('Dark theme', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('applies the dark palette to the page and to portalled overlays, and survives a reload', async ({ page }) => {
    await chooseTheme(page, 'Dark');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => bodyBackground(page)).toBe(DARK_PAGE_BG);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#221a14');

    await page.goto('/daily');
    await expect(page.getByRole('heading', { name: 'Daily', level: 1 })).toBeVisible();
    await page.locator('main').click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('q');
    const quickAddPanel = page.getByRole('dialog', { name: 'Quick add task' }).locator('> div');
    await expect(quickAddPanel).toHaveCSS('background-color', DARK_OVERLAY_BG);
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('automatic follows the operating system color scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await chooseTheme(page, 'Automatic');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'beige');
    await expect.poll(() => bodyBackground(page)).toBe(BEIGE_PAGE_BG);
  });

  test('logged-out screens stay beige', async ({ page }) => {
    await chooseTheme(page, 'Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Logout' }).first().click();
    await page.waitForURL(/\/login/);

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    await expect.poll(() => bodyBackground(page)).toBe(BEIGE_PAGE_BG);
  });

  test('the header menu switches theme from its Theme section, after Show', async ({ page }) => {
    await page.goto('/daily');
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    const menu = page.getByRole('menu');

    const labels = await menu.locator('.toolbar-section-label').allTextContents();
    expect(labels.slice(-2)).toEqual(['Show', 'Theme']);

    const themeGroup = menu.getByRole('radiogroup', { name: 'Theme' });
    await expect(themeGroup.getByRole('radio')).toHaveCount(3);
    await themeGroup.getByRole('radio', { name: 'Dark', exact: true }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(themeGroup.getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');

    await themeGroup.getByRole('radio', { name: 'White', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'white');
  });
});
