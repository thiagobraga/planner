import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test('typing wasd toggles debug cards on tasks and habits', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const today = new Date().toISOString().slice(0, 10);
  const title = `Debug task ${Date.now()}`;
  const task = await api.post<ApiTask>('/tasks', { title, dueDate: today });
  const habit = await api.post<{ id: string }>('/habits', { name: `Debug habit ${Date.now()}` });

  try {
    await page.goto('/daily/list');
    const row = page.locator(`[data-task-id="${task.id}"]`);
    await expect(row.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByTestId('debug-card')).toHaveCount(0);

    await page.keyboard.type('wasd');
    const card = row.getByTestId('debug-card');
    await expect(card).toContainText(`[ID: ${task.id.slice(0, 8)}]`);
    await expect(card).toContainText(/\[Created: \d{4}(-\d{2}){5}\]/);

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/debug-mode-daily-desktop.png' });

    // Persists across navigation and reloads.
    await page.goto('/habits');
    await expect(page.getByTestId('debug-card').filter({ hasText: habit.id.slice(0, 8) })).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/debug-mode-habits-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/debug-mode-habits-mobile.png' });

    await page.keyboard.type('wasd');
    await expect(page.getByTestId('debug-card')).toHaveCount(0);
  } finally {
    await api.delete(`/tasks/${task.id}`);
    await api.delete(`/habits/${habit.id}`);
  }
  expect(errors).toEqual([]);
});

test('typing wasd inside a text field does not toggle debug mode', async ({ page }) => {
  await page.goto('/daily/list');
  await page.keyboard.press('/');
  await page.keyboard.type('wasd');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('debug-card')).toHaveCount(0);
});
