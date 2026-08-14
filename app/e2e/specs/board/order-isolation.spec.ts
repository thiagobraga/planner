import { dragCard } from '../../fixtures/drag';
import { card, expect, moveToStatus, openBoard, statusColumn, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('reordering inside a status column does not change list order', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-order'),
    color: '#adb9c1',
  });

  try {
    const [backlog] = await api.seedStatuses(collection.id);
    const first = await api.createTask({
      title: uniqueName('first'),
      collectionId: collection.id,
      orderValue: 1000,
    });
    const second = await api.createTask({
      title: uniqueName('second'),
      collectionId: collection.id,
      orderValue: 2000,
    });
    await moveToStatus(api, first, backlog, 0);
    await moveToStatus(api, second, backlog, 1);

    await openBoard(page, collection.id);
    await dragCard(page, card(page, second.id), card(page, first.id));
    await expect(statusColumn(page, backlog.id).locator('[data-card-id]').first()).toHaveAttribute('data-card-id', second.id);

    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.locator('[data-task-id]').first()).toHaveAttribute('data-task-id', first.id);

    const view = await api.fetchCollectionView(collection.id);
    expect(view.tasks.map((task) => task.id)).toEqual([first.id, second.id]);
    expect(view.boardOrder.status[second.id]).toBe(0);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
