import { dragCard } from '../../fixtures/drag';
import { card, expect, moveToStatus, openBoard, statusColumn, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('dragging a card between status columns persists after reload', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-drag'),
    color: '#adb9c1',
  });

  try {
    const [backlog, , doing] = await api.seedStatuses(collection.id);
    const task = await api.createTask({
      title: uniqueName('drag-me'),
      collectionId: collection.id,
    });
    await moveToStatus(api, task, backlog);

    await openBoard(page, collection.id);
    await expect(statusColumn(page, backlog.id).locator(`[data-card-id="${task.id}"]`)).toBeVisible();

    await dragCard(page, card(page, task.id), statusColumn(page, doing.id).locator('.board-column-cards'));
    await expect(statusColumn(page, doing.id).locator(`[data-card-id="${task.id}"]`)).toBeVisible();

    await page.reload();
    await expect(statusColumn(page, doing.id).locator(`[data-card-id="${task.id}"]`)).toBeVisible();
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.statusId,
    ).toBe(doing.id);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
