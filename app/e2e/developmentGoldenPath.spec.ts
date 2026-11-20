import crypto from 'node:crypto';
import { request, type Page } from '@playwright/test';
import { API_URL, expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import { openBoard } from './specs/board/helpers';
import type { TaskDocumentDto } from '../src/contracts/document';

/**
 * Development-home golden path: a task captured in Daily and a note in Inbox
 * open in details; a parent plan gets six real subtasks written between
 * paragraphs; the card previews five, Show all opens Only tasks and switching
 * back keeps the prose; the export, a second tab and an agent's live change
 * all see the same plan.
 */

test.use({ storageState: STORAGE_STATE_PATH });

const unique = (prefix: string) => `${prefix} ${crypto.randomUUID().slice(0, 6)}`;
const panel = (page: Page) => page.getByRole('complementary', { name: 'Task details' });
const editor = (page: Page) => panel(page).getByRole('textbox', { name: 'Description' });
const closePanel = (page: Page) => panel(page).getByRole('button', { name: 'Close details' }).click();

test('a note and a parent plan with six subtasks among paragraphs', async ({ api, page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const note = await api.post<{ id: string; title: string }>('/tasks', { title: unique('Context note'), type: 'note' });
  const collection = await api.createCollection({ name: unique('golden'), color: '#adb9c1' });
  const captured = unique('Daily capture');
  try {
    await page.goto('/daily/list');
    await page.locator('body').press('q');
    const quickAdd = page.getByRole('textbox', { name: 'Task title', exact: true });
    await quickAdd.fill(`${captured} today`);
    await quickAdd.press('Enter');
    await page.getByText(captured, { exact: true }).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue(captured);
    await closePanel(page);

    await page.goto('/inbox');
    await page.locator(`[data-task-id="${note.id}"]`).getByText(note.title).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue(note.title);
    await editor(page).click();
    await page.keyboard.type('Why this matters');
    await expect(panel(page).getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await closePanel(page);

    await api.seedStatuses(collection.id);
    const parent = await api.createTask({ title: unique('Plan'), collectionId: collection.id });
    await openBoard(page, collection.id);
    await page.locator(`[data-card-id="${parent.id}"] h3`).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue(parent.title);

    // Keyboard only, like someone writing: text, Ctrl+Shift+T, title, Enter, keep typing.
    // q and / are global shortcuts; inside the editor they must stay text.
    await editor(page).click();
    await page.keyboard.type('Ask q / later. ');
    await expect(page.getByRole('textbox', { name: 'Task title', exact: true })).toHaveCount(0);
    for (let step = 1; step <= 6; step++) {
      await page.keyboard.type(`Paragraph before step ${step}`);
      await page.keyboard.press('Control+Shift+T');
      const composer = panel(page).getByRole('textbox', { name: 'New task title' });
      await composer.fill(`Step ${step}`);
      await composer.press('Enter');
      await expect(editor(page).getByRole('button', { name: `Open Step ${step}` })).toBeVisible();
      await expect(editor(page)).toBeFocused();
    }
    await expect(panel(page).getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect.poll(async () => {
      const doc = await api.get<TaskDocumentDto>(`/tasks/${parent.id}/document`);
      return (doc.content.content ?? []).filter((node) => node.type === 'taskReference').length;
    }).toBe(6);
    await expect(panel(page).getByText('Other subtasks')).toHaveCount(0);
    await page.screenshot({ path: 'dist/screenshots/golden-path-plan.png' });

    await closePanel(page);
    const card = page.locator(`[data-card-id="${parent.id}"]`);
    await expect(card.locator('.board-card-checklist-row')).toHaveCount(5);
    await expect(card.getByText('0 of 6')).toBeVisible();

    await card.getByRole('button', { name: 'Show all 6 subtasks' }).click();
    await expect(panel(page).getByRole('radio', { name: 'Only tasks' })).toBeChecked();
    for (let step = 1; step <= 6; step++) {
      await expect(panel(page).getByRole('button', { name: `Open Step ${step}` })).toBeVisible();
    }
    await panel(page).getByRole('radio', { name: 'Full content' }).click();
    await expect(editor(page)).toContainText('Paragraph before step 6');
    await expect(editor(page)).toContainText('Ask q / later.');
    await closePanel(page);

    const exported = await api.get<{ documents: Array<{ taskId: string; markdown: string }> }>('/account/export');
    const plan = exported.documents.find((doc) => doc.taskId === parent.id);
    expect(plan?.markdown).toContain('Paragraph before step 3');
    expect(plan?.markdown).toContain('Step 3');

    const other = await page.context().newPage();
    await other.goto(`/collection/${collection.id}?task=${parent.id}`);
    await expect(other.getByRole('complementary', { name: 'Task details' }).getByRole('textbox', { name: 'Description' })).toContainText('Paragraph before step 6');
    await other.close();

    const view = await api.fetchCollectionView(collection.id);
    const first = view.tasks.find((entry) => entry.title === 'Step 1')!;
    const created = await api.post<{ token: { id: string }; rawToken: string }>('/api-tokens', { name: 'Golden agent', scopes: ['read', 'write'], expiresInDays: 30 });
    const agent = await request.newContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: true, extraHTTPHeaders: { Authorization: `Bearer ${created.rawToken}` } });
    try {
      const done = await agent.post(`${API_URL}/tasks/${first.id}/complete`, { data: {} });
      expect(done.status(), await done.text()).toBe(200);
      await expect(card.getByText('1 of 6')).toBeVisible();
    } finally {
      await agent.dispose();
      await api.delete(`/api-tokens/${created.token.id}`).catch(() => {});
    }
    await page.screenshot({ path: 'dist/screenshots/golden-path-board.png' });
  } finally {
    await api.deleteCollection(collection.id).catch(() => {});
    await api.delete(`/tasks/${note.id}`).catch(() => {});
    const found = await api.get<{ tasks: Array<{ id: string }> }>(`/search?q=${encodeURIComponent(captured)}`).catch(() => ({ tasks: [] }));
    for (const task of found.tasks) await api.delete(`/tasks/${task.id}`).catch(() => {});
  }
});

test('a subtask row on a card opens that subtask, not its parent', async ({ api, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const collection = await api.createCollection({ name: unique('edge'), color: '#adb9c1' });
  try {
    await api.seedStatuses(collection.id);
    const parent = await api.createTask({ title: unique('Parent'), collectionId: collection.id });
    const child = await api.createTask({ title: 'Only the child', collectionId: collection.id, parentTaskId: parent.id });
    await openBoard(page, collection.id);

    await page.locator(`[data-card-id="${parent.id}"]`).getByText('Only the child', { exact: true }).click();
    await expect(panel(page).getByRole('textbox', { name: 'Title' })).toHaveValue('Only the child');
    await expect(page).toHaveURL(new RegExp(`task=${child.id}`));
    expect((await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === child.id)?.isCompleted).toBe(false);
  } finally {
    await api.deleteCollection(collection.id).catch(() => {});
  }
});
