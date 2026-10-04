import type { ApiSection } from '../../../src/api/client';
import { dragCard } from '../../fixtures/drag';
import { expect, openBoard, setGroupBy, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('no-section column stays last after reordering section columns', async ({ api, page }) => {
  const collection = await api.createCollection({
    name: uniqueName('board-section-order'),
    color: '#adb9c1',
  });

  try {
    const first = await api.post<ApiSection>(`/collections/${collection.id}/sections`, { name: uniqueName('alpha') });
    const second = await api.post<ApiSection>(`/collections/${collection.id}/sections`, { name: uniqueName('beta') });

    await openBoard(page, collection.id);
    await setGroupBy(page, 'Section');

    const columnIds = () => page.locator('[data-column-id]').evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute('data-column-id')),
    );
    await expect.poll(columnIds).toEqual([`section:${first.id}`, `section:${second.id}`, 'section:none']);

    await dragCard(
      page,
      page.locator(`[data-column-id="section:${first.id}"] .board-column-header`),
      page.locator(`[data-column-id="section:${second.id}"] .board-column-header`),
    );

    await expect.poll(columnIds).toEqual([`section:${second.id}`, `section:${first.id}`, 'section:none']);

    await page.reload();
    await expect(page.getByTestId('board-view')).toBeVisible();
    await expect.poll(columnIds).toEqual([`section:${second.id}`, `section:${first.id}`, 'section:none']);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
