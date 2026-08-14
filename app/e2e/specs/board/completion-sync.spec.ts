import { dragCard } from '../../fixtures/drag';
import { card, expect, moveToStatus, openBoard, statusColumn, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('completion column and list checkbox stay synchronized', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-completion'),
    color: '#adb9c1',
  });

  try {
    const [backlog, , , completed] = await api.seedStatuses(collection.id);
    const task = await api.createTask({
      title: uniqueName('complete-me'),
      collectionId: collection.id,
    });
    await moveToStatus(api, task, backlog);

    await openBoard(page, collection.id);
    await dragCard(page, card(page, task.id), statusColumn(page, completed.id).locator('.board-column-cards'));
    await expect(card(page, task.id).getByRole('heading')).toHaveClass(/line-through/);

    await page.getByRole('button', { name: 'List' }).click();
    const row = page.locator(`[data-task-id="${task.id}"]`);
    await expect(row.locator('.task-item-title-text')).toHaveClass(/line-through/);
    await row.getByRole('button', { name: new RegExp(`Reopen.*${task.title}`, 'i') }).click();
    await expect(row.locator('.task-item-title-text')).not.toHaveClass(/line-through/);

    await openBoard(page, collection.id);
    await expect(statusColumn(page, backlog.id).locator(`[data-card-id="${task.id}"]`)).toBeVisible();
  } finally {
    await api.deleteCollection(collection.id);
  }
});
