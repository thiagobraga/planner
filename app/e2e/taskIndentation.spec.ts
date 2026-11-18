import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import { chooseView } from './fixtures/view';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test('task row shortcuts and menu persist structural indentation', async ({ api, page }) => {
  const collection = await api.createCollection({ name: `indent-${Date.now()}`, color: '#c9483b' });
  const parent = await api.createTask({ title: 'Indent parent', collectionId: collection.id, dueDate: '2026-11-12', orderValue: 1000 });
  const child = await api.createTask({ title: 'Indent child', collectionId: collection.id, orderValue: 2000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const row = page.locator(`[data-task-id="${child.id}"]`);
  const parentOf = async () => (await api.fetchCollectionView(collection.id)).tasks.find((task) => task.id === child.id);

  try {
    await page.goto(`/collection/${collection.id}`);
    await expect(row).toBeVisible();
    await page.locator(`[data-task-id="${parent.id}"]`).click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Indent', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('menuitem', { name: 'Unindent', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');

    await row.click();
    await expect(row).toBeFocused();
    await page.keyboard.press('Tab');
    await expect.poll(async () => (await parentOf())?.parentTaskId).toBe(parent.id);
    await expect(row).toHaveCSS('padding-left', '24px');
    await page.reload();
    await expect(row).toHaveCSS('padding-left', '24px');

    await row.click();
    await page.keyboard.press(']');
    await expect.poll(async () => (await parentOf())?.parentTaskId ?? null).toBeNull();
    await row.click();
    await page.keyboard.press('[');
    await expect.poll(async () => (await parentOf())?.parentTaskId).toBe(parent.id);

    await row.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Indent', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('menuitem', { name: 'Unindent', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await page.getByRole('menuitem', { name: 'Unindent', exact: true }).click();
    await expect.poll(async () => (await parentOf())?.parentTaskId ?? null).toBeNull();
    await page.reload();
    await expect(row).toHaveCSS('padding-left', '0px');

    await chooseView(page, { layout: 'Columns', style: 'Notebook' });
    await expect(row).toBeVisible();
    await row.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Indent', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await page.getByRole('menuitem', { name: 'Indent', exact: true }).click();
    await expect.poll(async () => (await parentOf())?.parentTaskId).toBe(parent.id);
    await page.reload();
    await expect(row).toHaveCSS('padding-left', '24px');

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/task-indentation-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await row.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Indent', exact: true })).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/task-indentation-mobile.png' });
    await page.keyboard.press('Escape');
    await chooseView(page, { layout: 'List' });
    await expect(row).toHaveCSS('padding-left', '24px');
    await page.screenshot({ path: 'dist/screenshots/task-indentation-list-mobile.png' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({ path: 'dist/screenshots/task-indentation-list-desktop.png' });
    expect(errors).toEqual([]);
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('Inbox can indent an undated row under its dated sibling', async ({ api, page }) => {
  const parent = await api.createTask({ title: 'Dated Inbox parent', dueDate: '2026-11-12', orderValue: 1000 });
  const child = await api.createTask({ title: 'Undated Inbox child', orderValue: 2000 });
  try {
    await page.goto('/inbox');
    const row = page.locator(`[data-task-id="${child.id}"]`);
    await expect(row).toBeVisible();
    await row.click({ button: 'right' });
    const indent = page.getByRole('menuitem', { name: 'Indent', exact: true });
    await expect(indent).toHaveAttribute('aria-disabled', 'false');
    await indent.click();
    await expect.poll(async () => {
      const inbox = await api.get<{ tasks: ApiTask[] }>('/views/inbox');
      return inbox.tasks.find((task) => task.id === child.id)?.parentTaskId;
    }).toBe(parent.id);
    await page.reload();
    await expect(row).toHaveCSS('padding-left', '24px');
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/inbox-indentation-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(row).toHaveCSS('padding-left', '24px');
    await page.screenshot({ path: 'dist/screenshots/inbox-indentation-mobile.png' });
  } finally {
    await api.delete(`/tasks/${child.id}`);
    await api.delete(`/tasks/${parent.id}`);
  }
});

test('rightward drag released over its own row persists nesting', async ({ api, page }) => {
  const collection = await api.createCollection({ name: `self-indent-${Date.now()}`, color: '#c9483b' });
  const parent = await api.createTask({ title: 'Self parent', collectionId: collection.id, orderValue: 1000 });
  const child = await api.createTask({ title: 'Self child', collectionId: collection.id, orderValue: 2000 });
  try {
    await page.goto(`/collection/${collection.id}`);
    const row = page.locator(`[data-task-id="${child.id}"]`);
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    const start = { x: box!.x + 70, y: box!.y + box!.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 12, start.y, { steps: 3 });
    await page.mouse.move(start.x + 48, start.y, { steps: 8 });
    await expect(row).toHaveCSS('padding-left', '24px');
    await page.mouse.up();
    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((task) => task.id === child.id)?.parentTaskId).toBe(parent.id);
    await page.reload();
    await expect(row).toHaveCSS('padding-left', '24px');
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('rightward drag over the parent row persists the first child position', async ({ api, page }) => {
  const collection = await api.createCollection({ name: `drag-indent-${Date.now()}`, color: '#c9483b' });
  const parent = await api.createTask({ title: 'Drag parent', collectionId: collection.id, dueDate: '2026-11-12', orderValue: 1000 });
  const child = await api.createTask({ title: 'Drag child', collectionId: collection.id, orderValue: 2000 });
  try {
    await page.goto(`/collection/${collection.id}`);
    const from = page.locator(`[data-task-id="${child.id}"]`);
    const to = page.locator(`[data-task-id="${parent.id}"]`);
    await expect(from).toBeVisible();
    const source = await from.boundingBox();
    const target = await to.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    const x = source!.x + Math.min(80, source!.width / 2);
    const y = source!.y + source!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 15, { steps: 4 });
    await page.mouse.move(target!.x + Math.min(80, target!.width / 2), target!.y + target!.height / 2, { steps: 8 });
    await page.mouse.move(target!.x + Math.min(110, target!.width / 2 + 30), target!.y + target!.height / 2, { steps: 5 });
    await expect(to.locator('xpath=..').locator('.task-list-slot')).toHaveCSS('margin-left', '24px');
    await page.mouse.up();
    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((task) => task.id === child.id)?.parentTaskId).toBe(parent.id);
    await page.reload();
    await expect(from).toHaveCSS('padding-left', '24px');
  } finally {
    await api.deleteCollection(collection.id);
  }
});
