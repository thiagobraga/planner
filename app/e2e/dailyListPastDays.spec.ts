import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test('Daily list keeps the earlier days of the week visible', async ({ page, api }) => {
  await api.patch('/preferences', {
    locale: 'en',
    timeZone: 'UTC',
    weekStart: 'sunday',
    hideCompletedTasks: false,
    dailyView: { style: 'notebook', range: 'week' },
  });
  const now = new Date('2026-11-18T12:00:00Z');
  await page.clock.setFixedTime(now);

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

test('a rejected deletion restores the Daily row when the refetch is unchanged', async ({ page, api }) => {
  await api.patch('/preferences', {
    dailyView: { style: 'notebook', range: 'week' },
    hideCompletedTasks: false,
  });
  await page.clock.setFixedTime(new Date('2026-11-18T12:00:00Z'));
  const task = await api.createTask({ title: `Rejected delete ${Date.now()}`, dueDate: '2026-11-18' });
  try {
    await page.route(`**/api/v1/tasks/${task.id}`, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Delete failed' } } })
        : route.continue(),
    );
    await page.goto('/daily/list');
    const row = page.locator(`[data-task-id="${task.id}"]`);
    await row.click({ button: 'right' });
    const failedDelete = page.waitForResponse((response) =>
      response.request().method() === 'DELETE' && response.url().endsWith(`/tasks/${task.id}`),
    );
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await failedDelete;
    await expect(row).toBeVisible();
  } finally {
    await api.delete(`/tasks/${task.id}`);
  }
});
