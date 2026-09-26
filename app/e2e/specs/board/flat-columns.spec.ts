import { mkdir } from 'node:fs/promises';

import type { ApiTask } from '../../../src/api/client';
import { expect, openBoard, statusColumn, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('Kanban columns are flat and add a task in the selected status', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-flat-columns'),
    color: '#adb9c1',
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await openBoard(page, collection.id);
    const [status] = await api.fetchStatuses(collection.id);
    const column = statusColumn(page, status.id);
    const title = uniqueName('board-inline-task');

    await expect(column).toHaveCSS('border-top-width', '0px');
    await expect(column.locator('.board-column-header')).toHaveCSS('border-bottom-width', '0px');
    await expect(column.locator('.board-column-count')).toHaveCount(0);
    await expect(page.getByText('Drop work here', { exact: true })).toHaveCount(0);
    await column.getByRole('button', { name: 'Add task', exact: true }).click();
    await column.getByRole('textbox', { name: 'Task title' }).fill(title);
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collection-kanban-add-task.png' });
    const createdResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/tasks') && response.request().method() === 'POST',
    );
    await column.getByRole('button', { name: 'Save', exact: true }).click();
    const created = await (await createdResponse).json() as ApiTask;
    await expect(column.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.find((task) => task.id === created.id)?.statusId,
    ).toBe(status.id);

    await page.screenshot({ path: 'dist/screenshots/collection-kanban-flat-columns.png' });
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await page.locator('#board-group-by').click();
    await page.getByRole('option', { name: 'Priority', exact: true }).click();
    await expect(page.locator('#board-group-by')).toContainText('Priority');
    expect(errors).toEqual([]);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
