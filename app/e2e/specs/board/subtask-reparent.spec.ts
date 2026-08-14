import { dragCard } from '../../fixtures/drag';
import { expect, moveToStatus, openBoard, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('dragging a subtask onto another card updates both checklists', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-subtask'),
    color: '#adb9c1',
  });

  try {
    const [backlog] = await api.seedStatuses(collection.id);
    const source = await api.createTask({
      title: uniqueName('source-parent'),
      collectionId: collection.id,
    });
    const target = await api.createTask({
      title: uniqueName('target-parent'),
      collectionId: collection.id,
    });
    const child = await api.createTask({
      title: uniqueName('moving-child'),
      collectionId: collection.id,
      parentTaskId: source.id,
    });
    await moveToStatus(api, source, backlog, 0);
    await moveToStatus(api, target, backlog, 1);

    await openBoard(page, collection.id);
    await expect(page.getByTestId(`card-subtasks-${source.id}`)).toHaveAttribute('aria-label', '0/1');
    await dragCard(
      page,
      page.locator(`[data-subtask-id="${child.id}"]`),
      page.getByTestId(`card-subtasks-${target.id}`),
    );

    await expect(page.getByTestId(`card-subtasks-${source.id}`)).toHaveAttribute('aria-label', '0/0');
    await expect(page.getByTestId(`card-subtasks-${target.id}`)).toHaveAttribute('aria-label', '0/1');
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === child.id)?.parentTaskId,
    ).toBe(target.id);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
