import { expect, type Page } from '@playwright/test';
import { test } from './coverage-fixture';

/** Covers the controls surfaced by the header's More options menu. */

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

  test('Daily exposes view and visibility controls through More options', async ({ page }) => {
    await page.goto('/daily');

    await page.getByRole('button', { name: 'More options', exact: true }).click();
    const controls = page.getByRole('menu');

    await expect(controls.getByText('View', { exact: true })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(controls.getByRole('button', { name: 'Kanban lists', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(controls.getByRole('button', { name: 'Kanban cards', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(controls.getByText('Show', { exact: true })).toBeVisible();
    await expect(controls.getByRole('checkbox', { name: 'Completed tasks' })).toBeChecked();
    await expect(controls.getByRole('checkbox', { name: 'Notes' })).toBeChecked();
  });

  test('view selector switches Inbox to Kanban lists', async ({ page }) => {
    await page.goto('/inbox');

    await page.getByRole('button', { name: 'More options', exact: true }).click();
    const controls = page.getByRole('menu');
    const list = controls.getByRole('button', { name: 'List', exact: true });
    const kanban = controls.getByRole('button', { name: 'Kanban lists', exact: true });

    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(kanban).toHaveAttribute('aria-pressed', 'false');

    await kanban.click();

    await expect(kanban).toHaveAttribute('aria-pressed', 'true');
    await expect(list).toHaveAttribute('aria-pressed', 'false');
  });

  test('completed and notes visibility switches flip independently', async ({ page }) => {
    await page.goto('/daily');

    await page.getByRole('button', { name: 'More options', exact: true }).click();
    const controls = page.getByRole('menu');
    const completed = controls.getByRole('checkbox', { name: 'Completed tasks' });
    const notes = controls.getByRole('checkbox', { name: 'Notes' });
    await expect(completed).toBeChecked();
    await expect(notes).toBeChecked();

    await controls.getByText('Completed tasks', { exact: true }).click();

    await expect(completed).not.toBeChecked();
    await expect(notes).toBeChecked();
  });
});
