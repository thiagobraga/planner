import { dragCard } from '../../fixtures/drag';
import { card, expect, groupByButton, openBoard, priorityColumn, setGroupBy, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

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
    await expect(groupByButton(page)).toHaveText('Group: Priority');
    await expect(priorityColumn(page, 1).locator(`[data-card-id="${task.id}"]`)).toBeVisible();
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.priority,
    ).toBe(1);
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('the grouping menu sits on the title row for Columns only and survives a reload', async ({ api, page }) => {
  const collection = await api.createCollection({ name: uniqueName('board-toolbar'), color: '#adb9c1' });

  try {
    await page.goto(`/collection/${collection.id}`);
    await expect(page.locator('.page-header-row').getByRole('button', { name: 'View', exact: true })).toBeVisible();
    await expect(groupByButton(page)).toHaveCount(0);

    await openBoard(page, collection.id);
    await setGroupBy(page, 'Section');
    await page.reload();
    await expect(groupByButton(page)).toHaveText('Group: Section');
    await expect(page.getByRole('button', { name: 'More options', exact: true })).toHaveCount(0);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
