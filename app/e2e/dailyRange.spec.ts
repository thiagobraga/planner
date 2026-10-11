import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

const DAILY_RANGE = /\/api\/v1\/daily\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/;

function rangeOf(path: string): { from: string; to: string } {
  const [, from, to] = path.match(/daily\/([\d-]+)\/([\d-]+)/)!;
  return { from: from!, to: to! };
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

test('each Daily route shows its view and loads it with one range request', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC', weekStart: 'sunday' });
  const today = new Date().toISOString().slice(0, 10);
  const title = `Range check ${Date.now()}`;
  const task = await api.post<ApiTask>('/tasks', { title, dueDate: today });

  const dailyCalls: string[] = [];
  const failedCalls: string[] = [];
  const collectionViewCalls: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() === 'GET' && DAILY_RANGE.test(url)) dailyCalls.push(new URL(url).pathname);
    if (url.includes('/views/collection/')) collectionViewCalls.push(url);
  });
  page.on('response', (response) => {
    if (DAILY_RANGE.test(response.url()) && !response.ok()) failedCalls.push(`${response.status()} ${response.url()}`);
  });

  try {
    await page.goto('/daily/list');
    await expect(page).toHaveURL(/\/daily\/list$/);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect.poll(() => dailyCalls.length).toBe(1);
    const list = rangeOf(dailyCalls[0]!);
    expect(list.from).toBe(list.to);

    // Switching view is a navigation, and the week is one request spanning 7 days.
    dailyCalls.length = 0;
    await page.getByRole('button', { name: 'Kanban cards', exact: true }).click();
    await expect(page).toHaveURL(/\/daily\/cards$/);
    await expect(page.getByTestId('daily-week-board')).toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect.poll(() => dailyCalls.length).toBe(1);
    const week = rangeOf(dailyCalls[0]!);
    expect(daysBetween(week.from, week.to)).toBe(6);

    // Another week asks for that range only.
    dailyCalls.length = 0;
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await expect.poll(() => dailyCalls.length).toBe(1);
    expect(daysBetween(week.from, rangeOf(dailyCalls[0]!).from)).toBe(7);

    // The URL, not storage, decides the view after a reload.
    await page.goto('/daily/monthly');
    await expect(page).toHaveURL(/\/daily\/monthly$/);
    await expect(page.locator('.monthly-ledger').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.monthly-ledger').first()).toBeVisible();

    // /daily returns to the last view; an unknown view falls back to the list.
    await page.goto('/daily');
    await expect(page).toHaveURL(/\/daily\/monthly$/);
    await page.goto('/daily/weekly');
    await expect(page).toHaveURL(/\/daily\/list$/);

    expect(failedCalls).toEqual([]);
    expect(collectionViewCalls).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await api.delete(`/tasks/${task.id}`);
  }
});
