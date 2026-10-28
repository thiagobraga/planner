import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('Daily controls expose visible labels and valid selection state', async ({ page, api }) => {
  const dueDate = new Date().toISOString().slice(0, 10);
  const task = await api.createTask({ title: 'Accessibility regression', dueDate });
  try {
    await page.setViewportSize({ width: 412, height: 823 });
    await page.goto('/daily/list');
    const row = page.locator(`[data-task-id="${task.id}"]`);
    await expect(row).toHaveAccessibleName('Accessibility regression');
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await expect(row).not.toHaveAttribute('aria-selected');
    await row.locator('.task-item-title-text').click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    const range = page.locator('.week-selector-trigger');
    const visibleRange = (await range.innerText()).replace(/\s+/g, ' ').trim();
    await expect(range).toHaveAccessibleName(visibleRange);
    const more = page.locator('.bottom-bar button');
    await expect(more).toHaveAccessibleName(/More|Mais/);
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
  } finally {
    await api.delete(`/tasks/${task.id}`);
  }
});
