import { mkdir } from 'node:fs/promises';

import type { ApiTask } from '../src/api/client';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('Quick Add creates a task in the open collection without blurring the page', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: `quick-add-${Date.now()}`,
    color: '#adb9c1',
  });
  const title = `Quick Add task ${Date.now()}`;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(`/collection/${collection.id}`);
    await expect(page.getByRole('button', { name: 'More options', exact: true })).toBeVisible();
    await page.locator('main').click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('q');

    const dialog = page.getByRole('dialog', { name: 'Quick add task' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('backdrop-filter', 'none');
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/quick-add-collection-desktop.png' });

    await dialog.getByRole('textbox', { name: 'Task title' }).fill(title);
    const createdResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/tasks') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Add Task' }).click();
    const created = await (await createdResponse).json() as ApiTask;

    expect(created.collectionId).toBe(collection.id);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect.poll(async () =>
      (await api.fetchCollectionView(collection.id)).tasks.some((task) => task.id === created.id),
    ).toBe(true);
    expect(errors).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('main').click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('q');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('backdrop-filter', 'none');
    await page.screenshot({ path: 'dist/screenshots/quick-add-collection-mobile.png' });
  } finally {
    await api.deleteCollection(collection.id);
  }
});
