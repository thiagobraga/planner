import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import type { ApiSection } from '../src/types/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('a collection section draft saves to its own section on blur', async ({ api, page }) => {
  const collection = await api.createCollection({ name: 'Notebook section drafts', color: '#c9483b' });
  const path = `/collections/${collection.id}/sections`;
  try {
    await api.post<ApiSection>(path, { name: 'First section' });
    const second = await api.post<ApiSection>(path, { name: 'Second section' });
    await page.goto(`/collection/${collection.id}`);
    const inputs = page.locator('.task-add-input');
    await expect(inputs).toHaveCount(3);
    await inputs.last().fill('Task in the second section');
    await inputs.first().click();

    await expect.poll(async () => {
      const { tasks } = await api.fetchCollectionView(collection.id);
      return tasks.find((task) => task.title === 'Task in the second section')?.sectionId;
    }).toBe(second.id);
    await page.reload();
    await expect(page.getByText('Task in the second section', { exact: true })).toBeVisible();
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collections-list-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('Task in the second section', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/collections-list-mobile.png' });
  } finally {
    await api.deleteCollection(collection.id);
  }
});
