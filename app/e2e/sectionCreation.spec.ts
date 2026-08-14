import { expect } from '@playwright/test';
import { test } from './coverage-fixture';

test.describe('Section Creation & Management E2E Tests', () => {
  test('creates sections, adds tasks within sections, renames, reloads, and deletes sections with modal options', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `section-user-${timestamp}@example.com`;
    const testPassword = 'Correct-Horse-Battery-Staple-99!';

    // 1. Register and login
    await page.goto('/register');
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });

    // 2. Navigate to Inbox page
    await page.goto('/inbox');
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible({ timeout: 10000 });

    // 3. Create a new section
    const newSectionBtn = page.getByRole('button', { name: /New section/i });
    await expect(newSectionBtn).toBeVisible();
    await newSectionBtn.click();

    const sectionInput = page.getByPlaceholder('New section');
    await expect(sectionInput).toBeVisible();
    await sectionInput.fill('Work Section');
    await sectionInput.press('Enter');

    // Section header should now be visible
    const workSectionHeader = page.locator('div[aria-label="Work Section"]');
    await expect(workSectionHeader).toBeVisible();

    // 4. Add task inside Work Section
    const taskInputs = page.locator('input.task-add-input');
    const taskCount = await taskInputs.count();
    const sectionTaskInput = taskInputs.nth(taskCount - 1);
    await sectionTaskInput.fill('Work Task Alpha');
    await sectionTaskInput.press('Enter');

    await expect(page.getByText('Work Task Alpha')).toBeVisible();

    // 5. Create a second section
    await page.getByRole('button', { name: /New section/i }).click();
    const sectionInput2 = page.getByPlaceholder('New section');
    await sectionInput2.fill('Personal Section');
    await sectionInput2.press('Enter');

    const personalSectionHeader = page.locator('div[aria-label="Personal Section"]');
    await expect(personalSectionHeader).toBeVisible();

    // Add task in Personal Section
    const taskInputsAfter = page.locator('input.task-add-input');
    const lastInput = taskInputsAfter.last();
    await lastInput.fill('Personal Task Beta');
    await lastInput.press('Enter');

    await expect(page.getByText('Personal Task Beta')).toBeVisible();

    // Take screenshot of sections with tasks
    await page.screenshot({ path: './dist/screenshots/sections-created.png' });

    // 6. Rename section via right-click context menu
    await workSectionHeader.click({ button: 'right' });
    const renameMenuItem = page.getByRole('menuitem', { name: 'Rename' });
    await renameMenuItem.click();

    const renameInput = page.locator('input[value="Work Section"]');
    await renameInput.fill('Work Projects');
    await renameInput.press('Enter');

    const workProjectsHeader = page.locator('div[aria-label="Work Projects"]');
    await expect(workProjectsHeader).toBeVisible();

    // 7. Reload and verify persistence
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('div[aria-label="Work Projects"]')).toBeVisible();
    await expect(page.getByText('Work Task Alpha')).toBeVisible();
    await expect(page.locator('div[aria-label="Personal Section"]')).toBeVisible();
    await expect(page.getByText('Personal Task Beta')).toBeVisible();

    // Take screenshot after reload
    await page.screenshot({ path: './dist/screenshots/sections-reloaded.png' });

    // 8. Delete "Work Projects" with "Move tasks to top-level"
    await page.locator('div[aria-label="Work Projects"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Delete modal appears
    const deleteModal = page.getByRole('dialog', { name: /Delete "Work Projects"\?/i });
    await expect(deleteModal).toBeVisible();

    // Choose "Move tasks to top-level"
    await page.getByRole('button', { name: 'Move tasks to top-level' }).click();
    await expect(page.locator('div[aria-label="Work Projects"]')).not.toBeVisible();
    // Task should still exist at top level
    await expect(page.getByText('Work Task Alpha')).toBeVisible();

    // 9. Delete "Personal Section" with "Delete section and tasks"
    await page.locator('div[aria-label="Personal Section"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const deleteModal2 = page.getByRole('dialog', { name: /Delete "Personal Section"\?/i });
    await expect(deleteModal2).toBeVisible();

    await page.getByRole('button', { name: 'Delete section and tasks' }).click();
    await expect(page.locator('div[aria-label="Personal Section"]')).not.toBeVisible();
    await expect(page.getByText('Personal Task Beta')).not.toBeVisible();

    // Take final screenshot
    await page.screenshot({ path: './dist/screenshots/sections-deleted.png' });
  });
});
