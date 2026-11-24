import crypto from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import { openBoard } from './specs/board/helpers';
import type { TaskDocumentDto } from '../src/contracts/document';

test.use({ storageState: STORAGE_STATE_PATH });

const unique = (prefix: string) => `${prefix} ${crypto.randomUUID().slice(0, 6)}`;
const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const panel = (page: Page) => page.getByRole('complementary', { name: 'Task details' });
const editor = (page: Page) => panel(page).getByRole('textbox', { name: 'Description' });

test('opens a Daily row in the floating panel, Escape closes it and focus returns to the row', async ({ api, page }) => {
  const task = await api.createTask({ title: unique('Daily detail'), dueDate: today() });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/daily/list');

    const row = page.locator(`[data-task-id="${task.id}"]`);
    await row.getByText(task.title).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue(task.title);
    await expect(page).toHaveURL(new RegExp(`task=${task.id}`));
    await expect(row).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(row).toBeFocused();
    await expect(page).not.toHaveURL(/task=/);
  } finally {
    await api.delete(`/tasks/${task.id}`).catch(() => {});
  }
});

test('edits the description from an Inbox row and keeps it after a reload', async ({ api, page }) => {
  const task = await api.createTask({ title: unique('Inbox detail') });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/inbox');

    await page.locator(`[data-task-id="${task.id}"]`).getByText(task.title).click();
    await editor(page).click();
    await page.keyboard.type('Durable plan text');
    await expect(panel(page).getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
    await expect(panel(page).getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect.poll(async () => (await api.get<TaskDocumentDto>(`/tasks/${task.id}/document`)).revision).toBe(1);

    await page.reload();
    await expect(editor(page)).toContainText('Durable plan text');
  } finally {
    await api.delete(`/tasks/${task.id}`).catch(() => {});
  }
});

test('opens a collection board card without completing it', async ({ api, page }) => {
  const collection = await api.createCollection({ name: unique('detail-board'), color: '#adb9c1' });
  try {
    await api.seedStatuses(collection.id);
    const parent = await api.createTask({ title: unique('Card'), collectionId: collection.id });
    await api.createTask({ title: 'Child step', collectionId: collection.id, parentTaskId: parent.id });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBoard(page, collection.id);

    await page.locator(`[data-card-id="${parent.id}"] h3`).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue(parent.title);
    await expect(panel(page).getByText('0 of 1 tasks · 0%')).toBeVisible();

    await panel(page).getByRole('radio', { name: 'Only tasks' }).click();
    await panel(page).getByRole('button', { name: 'Open Child step' }).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue('Child step');
    await panel(page).getByRole('navigation', { name: 'Parent tasks' }).getByRole('button', { name: parent.title }).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue(parent.title);
    expect((await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === parent.id)?.isCompleted).toBe(false);
  } finally {
    await api.deleteCollection(collection.id).catch(() => {});
  }
});

test('a save that meets a newer revision keeps the draft until the user keeps theirs', async ({ api, page }) => {
  const task = await api.createTask({ title: unique('Conflict') });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/inbox?task=${task.id}`);
    await expect(editor(page)).toBeVisible();

    // Another writer saves revision 1 while this page holds an unsaved draft on revision 0.
    await editor(page).click();
    await page.keyboard.type('Mine');
    const putOk = await page.evaluate(async (id) => {
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.includes('_csrf='))?.split('=')[1] ?? '').split(':')[0];
      const res = await fetch(`/api/v1/tasks/${id}/document`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify({ baseRevision: 0, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Theirs' }] }] } }),
      });
      return res.ok;
    }, task.id);
    expect(putOk).toBe(true);

    await expect(panel(page).getByRole('alert').filter({ hasText: 'Updated elsewhere.' })).toBeVisible();
    await expect(editor(page)).toContainText('Mine');

    await panel(page).getByRole('button', { name: 'Keep mine' }).click();
    await expect(panel(page).getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect.poll(async () => JSON.stringify((await api.get<TaskDocumentDto>(`/tasks/${task.id}/document`)).content)).toContain('Mine');
  } finally {
    await api.delete(`/tasks/${task.id}`).catch(() => {});
  }
});

test('becomes a modal bottom sheet at 390px and returns focus on close', async ({ api, page }) => {
  const task = await api.createTask({ title: unique('Phone detail') });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/inbox');

    const row = page.locator(`[data-task-id="${task.id}"]`);
    await row.focus();
    await page.keyboard.press('o');
    const sheet = page.getByRole('dialog', { name: 'Task details' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet.getByRole('radio', { name: 'Full content' })).toHaveAttribute('aria-checked', 'true');

    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await sheet.getByRole('button', { name: 'Close details' }).click();
    await expect(sheet).toBeHidden();
    await expect(row).toBeFocused();
  } finally {
    await api.delete(`/tasks/${task.id}`).catch(() => {});
  }
});
