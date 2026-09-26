import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test('Daily board retains scheduled cards while keeping Migrate scoped to Daily tasks', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const createdIds: string[] = [];
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const today = new Date().toISOString().slice(0, 10);
  const suffix = Date.now();
  const datedTitle = `Plan the week ${suffix}`;
  const undatedTitle = `Sort paperwork ${suffix}`;
  const enterBoard = async () => {
    await page.goto('/daily');
    await page.getByRole('button', { name: 'Kanban cards', exact: true }).click();
    await expect(page.getByTestId('daily-week-board')).toBeVisible();
  };

  try {
    await enterBoard();
    expect(page.url()).toContain('/daily');
    await expect(page).toHaveTitle(/Planner/i);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await expect(page.getByText('Drop work here', { exact: true })).toHaveCount(0);
    const checkGridRows = async () => {
      const centers = await page.locator('.daily-week-board h2, .daily-board-add-task:not([hidden])').evaluateAll((elements) => {
        const main = document.querySelector('main')!;
        return elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return (rect.y + rect.height / 2 - main.getBoundingClientRect().top + main.scrollTop) % 24;
        });
      });
      for (const center of centers) expect(Math.abs(center - 12)).toBeLessThan(1);
      await expect(page.locator('.daily-board-add-icon').first()).toHaveText('+');
    };
    await checkGridRows();

    for (const [columnId, title, dueDate] of [
      [`day:${today}`, datedTitle, today],
      ['migrate', undatedTitle, null],
    ] as const) {
      const column = page.locator(`[data-column-id="${columnId}"]`);
      await expect(column).toHaveCSS('border-top-width', '0px');
      await expect(column).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await column.getByRole('button', { name: 'Add task', exact: true }).click();
      const input = column.getByRole('textbox', { name: 'Task title' });
      await expect(input).toBeFocused();
      await input.fill(title);
      const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/tasks') && response.request().method() === 'POST');
      await input.press('Enter');
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const task = await response.json() as ApiTask;
      createdIds.push(task.id);
      expect(task.dueDate?.slice(0, 10) ?? null).toBe(dueDate);
      await expect(column.getByRole('heading', { name: title, exact: true })).toBeVisible();
      const card = column.locator(`[data-card-id="${task.id}"]`);
      expect((await card.boundingBox())!.height).toBeLessThan(100);
    }

    await enterBoard();
    await expect(page.getByRole('heading', { name: datedTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: undatedTitle, exact: true })).toHaveCount(0);
    await expect(page.locator('.daily-week-board [data-column-id]').last()).toHaveAttribute('data-column-id', 'migrate');
    await checkGridRows();
    const inbox = await api.get<{ tasks: ApiTask[] }>('/views/inbox');
    expect(inbox.tasks.filter((task) => createdIds.includes(task.id))).toHaveLength(2);

    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    const futureColumn = page.locator('[data-column-id^="day:"]').first();
    const futureDate = (await futureColumn.getAttribute('data-column-id'))!.slice(4);
    const futureTitle = `Prepare next week ${suffix}`;
    await futureColumn.getByRole('button', { name: 'Add task', exact: true }).click();
    await futureColumn.getByRole('textbox', { name: 'Task title' }).fill(futureTitle);
    const futureResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/tasks') && response.request().method() === 'POST');
    await futureColumn.getByRole('button', { name: 'Save', exact: true }).click();
    const futureTask = await (await futureResponse).json() as ApiTask;
    createdIds.push(futureTask.id);
    expect(futureTask.dueDate?.slice(0, 10)).toBe(futureDate);
    await enterBoard();
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await expect(page.getByRole('heading', { name: futureTitle, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Previous week', exact: true }).click();

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/daily-kanban-refined-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/daily-kanban-refined-mobile.png' });
    const migrate = page.locator('[data-column-id="migrate"]');
    await migrate.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect(migrate.getByRole('textbox', { name: 'Task title' })).toBeVisible();
    await migrate.getByRole('textbox', { name: 'Task title' }).press('Escape');
    await expect(migrate.getByRole('textbox')).toHaveCount(0);
    await expect(migrate.getByRole('button', { name: 'Add task', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    for (const id of createdIds) await api.delete(`/tasks/${id}`);
  }
});

test('Daily Kanban lists keeps journal rows and the destination date', async ({ page, api }) => {
  const errors: string[] = [];
  const createdIds: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const title = `Journal board row ${Date.now()}`;
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto('/daily');
    await page.getByRole('button', { name: 'Kanban lists', exact: true }).click();
    await expect(page.getByTestId('daily-week-board')).toBeVisible();
    const column = page.locator(`[data-column-id="day:${today}"]`);
    await expect(column.locator('.board-column-lists')).toBeVisible();
    await expect(column.locator('.board-card')).toHaveCount(0);

    await column.getByRole('button', { name: 'Add task', exact: true }).click();
    await column.getByRole('textbox', { name: 'Task title' }).fill(title);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/tasks') && response.request().method() === 'POST');
    await column.getByRole('textbox', { name: 'Task title' }).press('Enter');
    const task = await (await responsePromise).json() as ApiTask;
    createdIds.push(task.id);
    expect(task.dueDate?.slice(0, 10)).toBe(today);
    await expect(column.getByText(title, { exact: true })).toBeVisible();

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/daily-kanban-lists-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/daily-kanban-lists-mobile.png' });
    expect(errors).toEqual([]);
  } finally {
    for (const id of createdIds) await api.delete(`/tasks/${id}`);
  }
});
