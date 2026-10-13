import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test('Daily list keeps the earlier days of the week visible', async ({ page, api }) => {
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC', weekStart: 'sunday', hideCompletedTasks: false });
  const now = new Date();
  test.skip(now.getUTCDay() === 0, 'Sunday is the first day of the week, so no earlier day exists');

  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const title = `Yesterday task ${Date.now()}`;
  const task = await api.post<ApiTask>('/tasks', { title, dueDate: yesterday });

  try {
    await page.goto('/daily/list');
    const day = page.locator(`[data-day-date="${yesterday}"]`);
    await expect(day.getByText(title, { exact: true })).toBeVisible();
    await expect(page.locator('[data-day-date="migrate"]').getByText(title, { exact: true })).toHaveCount(0);

    const sundayOffset = now.getUTCDay();
    const sunday = new Date(now.getTime() - sundayOffset * 86_400_000).toISOString().slice(0, 10);
    await expect(page.locator(`[data-day-date="${sunday}"]`)).toBeVisible();

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/daily-list-past-days-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/daily-list-past-days-mobile.png' });
  } finally {
    await api.delete(`/tasks/${task.id}`);
  }
});
