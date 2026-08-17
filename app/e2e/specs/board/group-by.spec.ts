import { dragCard } from '../../fixtures/drag';
import { card, expect, openBoard, priorityColumn, setGroupBy, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('priority mode has four fixed columns and persists card priority', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-priority'),
    color: '#adb9c1',
  });

  try {
    const task = await api.createTask({
      title: uniqueName('priority-card'),
      collectionId: collection.id,
      priority: 2,
    });

    await openBoard(page, collection.id);
    await setGroupBy(page, 'Priority');
    await expect(page.locator('[data-column-id^="priority:"]')).toHaveCount(4);

    await dragCard(page, card(page, task.id), priorityColumn(page, 1).locator('.board-column-cards'));
    await expect(priorityColumn(page, 1).locator(`[data-card-id="${task.id}"]`)).toBeVisible();

    await page.reload();
    await expect(page.locator('#board-group-by')).toContainText('Priority');
    await expect(priorityColumn(page, 1).locator(`[data-card-id="${task.id}"]`)).toBeVisible();
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.priority,
    ).toBe(1);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
