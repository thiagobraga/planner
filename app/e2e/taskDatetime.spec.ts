import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test('sets due time, duration and deadline from the task context menu', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const today = new Date().toISOString().slice(0, 10);
  const deadline = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const title = `Dentist ${Date.now()}`;
  const task = await api.post<ApiTask>('/tasks', { title, dueDate: today });

  try {
    await page.goto('/daily');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    const row = page.locator('.task-item').filter({ hasText: title });
    await expect(row).toBeVisible();

    await row.getByText(title, { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Set date' }).click();

    const picker = page.locator('.task-date-picker');
    await expect(picker.getByLabel('Date', { exact: true })).toHaveValue(today);
    await picker.getByLabel('Time', { exact: true }).fill('10:30');
    await picker.getByLabel('Duration (min)').fill('30');
    await picker.getByLabel('Deadline', { exact: true }).fill(deadline);
    await picker.getByLabel('Deadline time').fill('18:00');

    const saved = page.waitForResponse((r) => r.url().endsWith(`/tasks/${task.id}`) && r.request().method() === 'PATCH');
    await picker.getByRole('button', { name: 'Save' }).click();
    const body = (await (await saved).json()) as ApiTask;
    expect(body.dueTime).toBe('10:30');
    expect(body.endTime).toBe('11:00');
    expect(body.deadlineTime).toBe('18:00');

    await expect(picker).toHaveCount(0);
    await expect(row.locator('.task-item-time')).toHaveText('10:30-11:00');
    await expect(row.locator('.task-item-deadline')).toContainText('18:00');
    await expect(row.locator('.task-item-deadline svg')).toBeVisible();

    await row.getByText(title, { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Set date' }).click();
    await page.locator('.task-date-picker').getByRole('button', { name: 'Clear' }).click();
    await expect(row.locator('.task-item-time')).toHaveCount(0);
    await expect(row.locator('.task-item-deadline')).toHaveCount(0);

    expect(errors).toEqual([]);
  } finally {
    await api.delete(`/tasks/${task.id}`);
  }
});
