import type { ApiStatus } from '../../../src/api/client';
import { dragCard } from '../../fixtures/drag';
import { expect, openBoard, statusColumn, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

async function openColumnMenu(page: Parameters<typeof openBoard>[0], status: ApiStatus): Promise<void> {
  await page.getByTestId(`board-column-menu-status:${status.id}`).click();
}

test('status columns can be renamed, recolored, reordered, and deleted with reassignment', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-columns'),
    color: '#adb9c1',
  });

  try {
    const statuses = await api.seedStatuses(collection.id);
    const extra = await api.createStatus(collection.id, {
      name: uniqueName('blocked'),
      color: '#adb9c1',
    });
    const task = await api.createTask({
      title: uniqueName('reassign-me'),
      collectionId: collection.id,
    });
    await api.moveTask(task.id, {
      parentTaskId: null,
      collectionId: collection.id,
      statusId: extra.id,
      scope: { kind: 'status', collectionId: collection.id, statusId: extra.id },
      position: 0,
    });

    await openBoard(page, collection.id);

    await openColumnMenu(page, extra);
    await page.getByRole('menuitem', { name: 'Rename column' }).click();
    const renamed = uniqueName('waiting');
    await statusColumn(page, extra.id).locator('input').fill(renamed);
    await statusColumn(page, extra.id).locator('input').press('Enter');
    await expect(statusColumn(page, extra.id).getByRole('heading', { name: renamed })).toBeVisible();

    await openColumnMenu(page, extra);
    await page.getByRole('menuitem', { name: 'Column color' }).click();
    const colorDialog = page.getByRole('dialog', { name: /change color|color picker/i });
    await colorDialog.getByRole('textbox', { name: 'Color value' }).fill('#c9483b');
    await colorDialog.getByRole('textbox', { name: 'Color value' }).press('Enter');
    await expect.poll(async () =>
      (await api.fetchStatuses(collection.id)).find((status) => status.id === extra.id)?.color,
    ).toBe('#c9483b');
    await colorDialog.press('Escape');
    await expect(colorDialog).toHaveCount(0);

    await dragCard(
      page,
      statusColumn(page, extra.id).locator('.board-column-header'),
      statusColumn(page, statuses[0].id).locator('.board-column-header'),
    );
    await expect.poll(async () => (await api.fetchStatuses(collection.id))[0]?.id).toBe(extra.id);

    await openColumnMenu(page, extra);
    await page.getByRole('menuitem', { name: 'Delete column' }).click();
    const dialog = page.getByRole('dialog', { name: new RegExp(renamed) });
    await dialog.getByLabel('Reassign tasks to').selectOption(statuses[0].id);
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(statusColumn(page, extra.id)).toHaveCount(0);
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.statusId,
    ).toBe(statuses[0].id);
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('deleting the final status surfaces the API conflict', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-last-column'),
    color: '#adb9c1',
  });

  try {
    const only = await api.createStatus(collection.id, {
      name: uniqueName('only-status'),
      color: '#adb9c1',
    });

    await openBoard(page, collection.id);
    await openColumnMenu(page, only);
    await page.getByRole('menuitem', { name: 'Delete column' }).click();
    const dialog = page.getByRole('dialog', { name: new RegExp(only.name) });
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog.getByRole('alert')).toContainText(/last status|cannot delete/i);
    await expect(statusColumn(page, only.id)).toBeVisible();
  } finally {
    await api.deleteCollection(collection.id);
  }
});
