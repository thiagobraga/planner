import { mkdir } from 'node:fs/promises';
import type { ApiSection, ApiTask } from '../src/api/client';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import { uniqueName } from './specs/board/helpers';

test.use({ storageState: STORAGE_STATE_PATH });

test('Daily names each task collection without loading collections or sections', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC', dailyView: { style: 'notebook', range: 'week' } });
  const today = new Date().toISOString().slice(0, 10);
  const collection = await api.createCollection({ name: uniqueName('finance'), color: '#b4a285' });

  try {
    const section = await api.post<ApiSection>(`/collections/${collection.id}/sections`, { name: uniqueName('Bills') });
    const title = uniqueName('Pay rent');
    await api.post<ApiTask>('/tasks', { title, dueDate: today, collectionId: collection.id, sectionId: section.id });

    const lookups: string[] = [];
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (/\/api\/v1\/collections(\/|$)/.test(pathname) || pathname.includes('/sections')) lookups.push(pathname);
    });

    await page.goto('/daily/list');
    const row = page.locator('.task-item').filter({ hasText: title });
    await expect(row.locator('.ui-collection-chip')).toHaveText(`${collection.name}${section.name}`);
    await page.waitForLoadState('networkidle');
    expect(lookups).toEqual([]);

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/daily-chip-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(row.locator('.ui-collection-chip')).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/daily-chip-mobile.png' });

    await row.getByText(title, { exact: true }).click({ button: 'right' });
    await expect.poll(() => lookups.some((p) => /\/api\/v1\/collections$/.test(p))).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await api.delete(`/collections/${collection.id}`);
  }
});
