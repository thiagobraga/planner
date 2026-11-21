import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { test } from './coverage-fixture';

/** Covers the page toolbar (View, Group), the planner menu's Show section and full width, and the view shortcuts. */

async function registerAndLogin(page: Page) {
  const timestamp = Date.now();
  const email = `e2e-toolbar-${timestamp}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  await page.goto('/register');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });
}

const row = (page: Page) => page.locator('.page-header-row');

test.describe('Page toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('Daily keeps date navigation and View on the title row as one button family', async ({ page }) => {
    await page.goto('/daily');
    await expect(page).toHaveURL(/\/daily\/list$/);

    for (const name of ['Today', 'Previous', 'Next', 'View']) {
      await expect(row(page).getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(row(page).getByRole('button', { name: 'Window', exact: true })).toHaveCount(0);
    const today = await row(page).getByRole('button', { name: 'Today', exact: true }).boundingBox();
    const viewButton = row(page).getByRole('button', { name: 'View', exact: true });
    expect((await viewButton.boundingBox())!.height).toBe(today!.height);
    for (const property of ['font-size', 'border-top-width', 'border-radius']) {
      const read = (selector: string) => row(page).getByRole('button', { name: selector, exact: true }).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
      expect(await read('View')).toBe(await read('Today'));
    }
    await expect(row(page).locator('.date-nav-trigger')).toHaveCSS('font-weight', '400');
    const title = await row(page).locator('h1').boundingBox();
    const view = await row(page).getByRole('button', { name: 'View', exact: true }).boundingBox();
    expect(Math.abs(title!.y + title!.height / 2 - (view!.y + view!.height / 2))).toBeLessThanOrEqual(2);
    await expect(page.getByRole('button', { name: 'More options', exact: true })).toHaveCount(0);
  });

  test('layout, style and range combine and survive a reload', async ({ page }) => {
    await page.goto('/daily/list');
    await row(page).getByRole('button', { name: 'View', exact: true }).click();
    const menu = page.getByRole('menu');
    await menu.getByRole('menuitemradio', { name: /Columns/ }).click();
    await expect(page).toHaveURL(/\/daily\/columns$/);
    await menu.getByRole('radio', { name: 'Cards' }).click();
    await menu.getByRole('button', { name: '3 days' }).click();
    await expect(menu.getByRole('button', { name: 'Month' })).toBeDisabled();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('daily-week-board').locator('[data-column-id^="day:"]')).toHaveCount(3);
    await page.reload();
    await expect(page.getByTestId('daily-week-board').locator('[data-column-id^="day:"]')).toHaveCount(3);
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/daily-columns-cards-3-days.png' });
  });

  test('view shortcuts switch layout, range and full width', async ({ page }) => {
    await page.goto('/daily/list');
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('v');
    await page.keyboard.press('k');
    await expect(page).toHaveURL(/\/daily\/columns$/);
    // The URL changes before the page renders the new layout; shortcuts act on what is on screen.
    await expect(page.getByTestId('daily-week-board')).toBeVisible();
    await page.keyboard.press('v');
    await page.keyboard.press('2');
    await expect(page.getByTestId('daily-week-board').locator('[data-column-id^="day:"]')).toHaveCount(2);

    await page.keyboard.press('v');
    await page.keyboard.press('f');
    await expect(page.locator('.app-shell')).toHaveClass(/full-width/);
    const main = await page.locator('.page-container').boundingBox();
    expect(main!.width).toBeGreaterThan(720);
  });

  test('view shortcuts work immediately after pointer navigation', async ({ page }) => {
    await page.getByRole('link', { name: 'Inbox', exact: true }).click();
    const daily = page.getByRole('link', { name: 'Daily', exact: true });
    await daily.click();
    await expect(page).toHaveURL(/\/daily\/list$/);
    await expect(daily).not.toBeFocused();
    await page.keyboard.press('v');
    await expect(daily).not.toBeFocused();
    await page.keyboard.press('f');
    await expect(page.locator('.app-shell')).toHaveClass(/full-width/);
    await page.keyboard.press('v');
    await page.keyboard.press('f');
    await expect(page.locator('.app-shell')).not.toHaveClass(/full-width/);
  });

  test('full width is toggled from the planner menu', async ({ page }) => {
    await page.goto('/daily');
    await page.getByRole('button', { name: 'Planner menu', exact: true }).click();
    const item = page.getByRole('menuitemradio', { name: /Full width/ });
    await expect(item).toHaveAttribute('aria-checked', 'false');
    await item.click();
    await expect(page.locator('.app-shell')).toHaveClass(/full-width/);
    await page.getByRole('button', { name: 'Planner menu', exact: true }).click();
    await expect(page.getByRole('menuitemradio', { name: /Full width/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('completed tasks and notes are toggled from the planner menu', async ({ page }) => {
    await page.goto('/daily');
    await page.getByRole('button', { name: 'Planner menu', exact: true }).click();
    const completed = page.getByRole('menuitemradio', { name: 'Completed tasks' });
    await expect(completed).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('menuitemradio', { name: 'Notes' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();

    await completed.click();
    await page.getByRole('button', { name: 'Planner menu', exact: true }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Completed tasks' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('menuitemradio', { name: 'Notes' })).toHaveAttribute('aria-checked', 'true');
  });

  test('phones get the toolbar in a bar above the navbar and a View sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/daily/list');
    const bar = page.getByTestId('page-toolbar-mobile');
    await expect(bar.getByRole('button', { name: 'View', exact: true })).toBeVisible();
    await expect(row(page).getByRole('button', { name: 'View', exact: true })).toHaveCount(0);
    const barBox = await bar.boundingBox();
    const navBox = await page.locator('.topbar').boundingBox();
    expect(Math.round(barBox!.y + barBox!.height)).toBeLessThanOrEqual(Math.round(navBox!.y) + 1);

    await bar.getByRole('button', { name: 'View', exact: true }).click();
    const sheet = page.locator('.page-menu-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.page-menu-item-shortcut').first()).toBeHidden();
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/daily-view-sheet-390.png' });
  });
});
