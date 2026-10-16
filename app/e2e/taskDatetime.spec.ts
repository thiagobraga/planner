import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (iso: string, n: number) => isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000));

test('sets due time, duration and deadline from the task context menu', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const today = isoDay(new Date());
  const deadline = plusDays(today, 3);
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
    await expect(picker.locator(`[data-date="${today}"]`)).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('button', { name: /^Add time/ }).click();
    await expect(picker.getByRole('heading', { name: 'Time and deadline' })).toBeVisible();

    await picker.getByLabel('Start').fill('10:30');
    await picker.getByRole('button', { name: '30 min' }).click();
    await expect(picker.getByText('Ends at 11:00')).toBeVisible();
    await picker.getByRole('switch').click();
    await picker.getByLabel('Deadline date').fill(deadline);
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
    await page.locator('.task-date-picker').getByRole('button', { name: 'Remove date' }).click();
    await expect(row.locator('.task-item-time')).toHaveCount(0);
    await expect(row.locator('.task-item-deadline')).toHaveCount(0);

    expect(errors).toEqual([]);
  } finally {
    await api.delete(`/tasks/${task.id}`);
  }
});

test('repeats every 2 weeks on Saturday counted from completion', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const today = isoDay(new Date());
  const title = `Long run ${Date.now()}`;
  const task = await api.post<ApiTask>('/tasks', { title, dueDate: today });
  const created: string[] = [task.id];

  try {
    await page.goto('/inbox');
    const row = page.locator('.task-item').filter({ hasText: title });
    await row.getByText(title, { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Set date' }).click();

    const picker = page.locator('.task-date-picker');
    await picker.getByRole('button', { name: /This weekend/ }).click();
    await picker.getByRole('button', { name: /^Repeat/ }).click();
    await picker.getByText('Custom', { exact: true }).click();
    await picker.getByLabel('Interval').fill('2');
    await expect(picker.getByRole('button', { name: 'Saturday' })).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('radio', { name: 'Completion' }).click();
    await expect(picker.getByTestId('recurrence-summary')).toHaveText('Every 2 weeks on Saturdays, after completion');
    await picker.getByRole('button', { name: 'Save' }).click();

    const saved = page.waitForResponse((r) => r.url().endsWith(`/tasks/${task.id}`) && r.request().method() === 'PATCH');
    await picker.getByRole('button', { name: 'Save' }).click();
    const body = (await (await saved).json()) as ApiTask;
    expect(body.recurrenceRule).toEqual({ type: 'weekly', interval: 2, weekdays: [6], fromCompletion: true });
    await expect(row.locator('.lucide-repeat')).toBeVisible();

    await api.post(`/tasks/${task.id}/complete`, {});

    // Counted from today's completion: the first Saturday after one extra week.
    let expected = plusDays(today, 8);
    while (new Date(`${expected}T00:00:00Z`).getUTCDay() !== 6) expected = plusDays(expected, 1);
    const inbox = await api.get<{ tasks: ApiTask[] }>('/views/inbox');
    const next = inbox.tasks.find((t) => t.title === title && !t.isCompleted);
    expect(next).toBeDefined();
    created.push(next!.id);
    expect(next!.dueDate!.slice(0, 10)).toBe(expected);
    expect(next!.recurrenceRule).toMatchObject({ fromCompletion: true, interval: 2 });

    expect(errors).toEqual([]);
  } finally {
    for (const id of created) await api.delete(`/tasks/${id}`).catch(() => undefined);
  }
});
