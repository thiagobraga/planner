import { expect } from '@playwright/test';
import { test } from './coverage-fixture';

test.describe('Task fields are contenteditable, not form inputs', () => {
  test('adds tasks on Enter or blur and saves an inline edit on blur', async ({ page }) => {
    const timestamp = Date.now();
    await page.goto('/register');
    await page.locator('input[type="email"]').fill(`editable-user-${timestamp}@example.com`);
    await page.locator('input[type="password"]').fill('Correct-Horse-Battery-Staple-99!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });

    await page.goto('/inbox');
    const heading = page.getByRole('heading', { level: 1, name: 'Inbox' });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Chrome's autofill bar keys off form fields, so the add field must not be one.
    const addField = page.getByRole('textbox', { name: 'New task…' }).first();
    await expect(addField).toHaveAttribute('contenteditable', 'plaintext-only');
    expect(await addField.evaluate((el) => el.tagName)).toBe('DIV');
    expect(await addField.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"New task…"');

    await addField.fill('Added with Enter');
    await addField.press('Enter');
    await expect(page.getByText('Added with Enter')).toBeVisible();
    await expect(addField).toHaveText('');
    await expect(addField).toBeFocused();

    await addField.fill('Added on blur');
    await heading.click();
    await expect(page.getByText('Added on blur')).toBeVisible();
    await expect(addField).toHaveText('');

    await page.getByText('Added on blur').dblclick();
    const editor = page.getByRole('textbox', { name: 'Task title' });
    await expect(editor).toHaveAttribute('contenteditable', 'plaintext-only');
    await editor.fill('Edited on blur');
    await heading.click();
    await expect(page.getByText('Edited on blur')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Added with Enter')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Edited on blur')).toBeVisible();
    await page.screenshot({ path: './dist/screenshots/task-contenteditable-desktop.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('textbox', { name: 'New task…' }).first().click();
    await page.screenshot({ path: './dist/screenshots/task-contenteditable-mobile.png' });
  });
});
