import { expect, openBoard, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('first board open seeds four statuses exactly once', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-seed'),
    color: '#adb9c1',
  });

  try {
    await openBoard(page, collection.id);
    await expect(page.locator('[data-column-id^="status:"]')).toHaveCount(4);

    const firstIds = await page.locator('[data-column-id^="status:"]').evaluateAll((columns) =>
      columns.map((column) => column.getAttribute('data-column-id')),
    );

    await page.reload();
    await expect(page.getByTestId('board-view')).toBeVisible();
    await expect(page.locator('[data-column-id^="status:"]')).toHaveCount(4);
    const reloadedIds = await page.locator('[data-column-id^="status:"]').evaluateAll((columns) =>
      columns.map((column) => column.getAttribute('data-column-id')),
    );
    expect(reloadedIds).toEqual(firstIds);

    const statuses = await api.fetchStatuses(collection.id);
    expect(statuses).toHaveLength(4);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
