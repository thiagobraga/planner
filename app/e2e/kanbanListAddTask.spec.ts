import { mkdir } from 'node:fs/promises';
import type { ApiSection, ApiTask } from '../src/api/client';
import type { ApiDailyView } from '../src/types/daily';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import { setGroupBy, uniqueName } from './specs/board/helpers';

test.use({ storageState: STORAGE_STATE_PATH });

for (const view of ['list', 'kanban'] as const) {
  test(`Daily ${view} adds consecutive tasks inline with Enter and blur`, async ({ page, api }) => {
    const errors: string[] = [];
    const postedTitles: string[] = [];
    const createdIds: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const titles = [
      uniqueName('Inline first'),
      uniqueName('Inline second'),
      uniqueName('Inline blur'),
      uniqueName('Inline cancelled'),
    ];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/tasks')) {
        const title = request.postDataJSON()?.title;
        if (titles.includes(title)) postedTitles.push(title);
      }
    });
    await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });

    try {
      await page.goto(`/daily/${view}`);
      const column = page.locator(view === 'list'
        ? `[data-day-date="${today}"]`
        : `[data-column-id="day:${today}"]`);
      const editor = column.getByRole('textbox', { name: 'New task…', exact: true });
      await expect(editor).toBeVisible();
      await expect(editor).toHaveAttribute('contenteditable', 'plaintext-only');
      await expect(column.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
      await expect(column.getByRole('button', { name: /^(Save|Cancel)$/ })).toHaveCount(0);

      for (const title of titles.slice(0, 2)) {
        await editor.fill(title);
        const responsePromise = page.waitForResponse((response) =>
          response.url().endsWith('/api/v1/tasks') &&
          response.request().method() === 'POST' &&
          response.request().postDataJSON()?.title === title);
        await editor.press('Enter');
        const response = await responsePromise;
        expect(response.status()).toBe(201);
        const task = await response.json() as ApiTask;
        createdIds.push(task.id);
        expect(task.dueDate?.slice(0, 10)).toBe(today);
        await expect(column.getByText(title, { exact: true })).toBeVisible();
        await expect(editor).toHaveText('');
        await expect(editor).toBeFocused();
      }

      await editor.fill(titles[2]);
      const blurResponse = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/tasks') &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.title === titles[2]);
      await page.getByRole('heading', { level: 1, name: 'Daily', exact: true }).click();
      const response = await blurResponse;
      expect(response.status()).toBe(201);
      const blurTask = await response.json() as ApiTask;
      createdIds.push(blurTask.id);
      expect(blurTask.dueDate?.slice(0, 10)).toBe(today);
      await expect(column.getByText(titles[2], { exact: true })).toBeVisible();
      await expect(editor).toHaveText('');

      await editor.fill(titles[3]);
      if (view === 'kanban') await editor.press('Escape');
      else await editor.fill('');
      await expect(editor).toHaveText('');
      await page.getByRole('heading', { level: 1, name: 'Daily', exact: true }).click();
      await page.reload();
      for (const title of titles.slice(0, 3)) {
        await expect(column.getByText(title, { exact: true })).toBeVisible();
      }
      await expect(column.getByText(titles[3], { exact: true })).toHaveCount(0);
      expect(postedTitles).toEqual(titles.slice(0, 3));
      const daily = await api.get<ApiDailyView>(`/daily/${today}/${today}`);
      const savedTasks = daily.days.find((day) => day.date === today)!.tasks;
      for (const title of titles.slice(0, 3)) {
        expect(savedTasks.filter((task) => task.title === title)).toHaveLength(1);
      }
      expect(savedTasks.some((task) => task.title === titles[3])).toBe(false);

      await mkdir('dist/screenshots', { recursive: true });
      await column.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `dist/screenshots/daily-${view}-inline-add-desktop.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await column.scrollIntoViewIfNeeded();
      await editor.click();
      await page.screenshot({ path: `dist/screenshots/daily-${view}-inline-add-mobile.png` });
      expect(errors).toEqual([]);
    } finally {
      for (const id of createdIds) await api.delete(`/tasks/${id}`);
    }
  });
}

test('Collection Kanban lists creates consecutive tasks inside the selected section', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const collection = await api.createCollection({ name: uniqueName('Inline collection'), color: '#b4a285' });

  try {
    const section = await api.post<ApiSection>(`/collections/${collection.id}/sections`, {
      name: uniqueName('Features'),
    });
    await page.goto(`/collection/${collection.id}`);
    await page.getByRole('button', { name: 'Kanban lists', exact: true }).click();
    await expect(page.getByTestId('board-view')).toBeVisible();
    await setGroupBy(page, 'Section');
    const column = page.locator(`[data-column-id="section:${section.id}"]`);
    const editor = column.getByRole('textbox', { name: 'New task…', exact: true });
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('contenteditable', 'plaintext-only');
    await expect(column.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
    await expect(column.getByRole('button', { name: /^(Save|Cancel)$/ })).toHaveCount(0);
    const titles = [uniqueName('Section first'), uniqueName('Section second')];

    for (const title of titles) {
      await editor.fill(title);
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/tasks') &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.title === title);
      await editor.press('Enter');
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const task = await response.json() as ApiTask;
      expect(task.collectionId).toBe(collection.id);
      expect(task.sectionId).toBe(section.id);
      await expect(column.getByText(title, { exact: true })).toBeVisible();
      await expect(editor).toHaveText('');
      await expect(editor).toBeFocused();
    }

    await page.reload();
    for (const title of titles) {
      await expect(column.getByText(title, { exact: true })).toBeVisible();
    }
    const saved = await api.fetchCollectionView(collection.id);
    for (const title of titles) {
      const matching = saved.tasks.filter((task) => task.title === title);
      expect(matching).toHaveLength(1);
      expect(matching[0].sectionId).toBe(section.id);
    }

    await mkdir('dist/screenshots', { recursive: true });
    await column.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'dist/screenshots/collection-kanban-list-inline-add-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await column.scrollIntoViewIfNeeded();
    await editor.click();
    await page.screenshot({ path: 'dist/screenshots/collection-kanban-list-inline-add-mobile.png' });
    expect(errors).toEqual([]);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
