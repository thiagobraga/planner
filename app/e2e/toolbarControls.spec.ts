import { expect, type Page } from '@playwright/test';
import { test } from './coverage-fixture';

/**
 * Covers the PageHeader/ButtonGroup unification: Today/Upcoming order (Today
 * first, each its own pill - not joined), the list/kanban segmented toggle,
 * and the completed/notes segmented toggle.
 */

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

test.describe('Header toolbar controls', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('Today/Upcoming render in order, each as its own button (not a joined group)', async ({ page }) => {
    await page.goto('/daily');

    const controls = page.locator('.daily-page-header-controls');
    const today = controls.getByRole('button', { name: 'Today' });
    const upcoming = controls.getByRole('button', { name: 'Upcoming' });

    await expect(today).toBeVisible();
    await expect(upcoming).toBeVisible();

    // Today comes first in the DOM.
    const order = await controls.getByRole('button').evaluateAll((buttons) =>
      buttons.map((b) => b.textContent?.trim()).filter((t) => t === 'Today' || t === 'Upcoming'),
    );
    expect(order).toEqual(['Today', 'Upcoming']);

    // Today is the active (filled) pill by default; Upcoming is not.
    await expect(today).toHaveClass(/bg-ink/);
    await expect(upcoming).not.toHaveClass(/bg-ink/);

    // Clicking Upcoming flips which pill is filled - they stay two separate
    // buttons throughout (no aria-pressed / role=group, unlike a ButtonGroup).
    await upcoming.click();
    await expect(upcoming).toHaveClass(/bg-ink/);
    await expect(today).not.toHaveClass(/bg-ink/);
    await expect(controls).not.toHaveAttribute('role', 'group');
  });

  test('list/kanban toggle switches the active segment on Inbox', async ({ page }) => {
    await page.goto('/inbox');

    const list = page.getByRole('button', { name: 'List' });
    const kanban = page.getByRole('button', { name: 'Kanban' });

    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(kanban).toHaveAttribute('aria-pressed', 'false');

    await kanban.click();

    await expect(kanban).toHaveAttribute('aria-pressed', 'true');
    await expect(list).toHaveAttribute('aria-pressed', 'false');
  });

  test('completed/notes toggle flips independently and relabels', async ({ page }) => {
    await page.goto('/daily');

    const hideCompleted = page.getByRole('button', { name: 'Hide completed tasks' });
    await expect(hideCompleted).toBeVisible();
    await expect(hideCompleted).toHaveAttribute('aria-pressed', 'false');

    await hideCompleted.click();

    const showCompleted = page.getByRole('button', { name: 'Show completed tasks' });
    await expect(showCompleted).toHaveAttribute('aria-pressed', 'true');

    // The other toggle (old notes) is untouched by clicking completed.
    await expect(page.getByRole('button', { name: 'Hide old notes' })).toHaveAttribute('aria-pressed', 'false');
  });
});
