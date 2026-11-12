import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { ApiStatus, ApiTask } from '../src/api/client';
import { expect, test, STORAGE_STATE_PATH } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

const today = () => new Date().toISOString().slice(0, 10);
const name = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function openTaskMenu(page: Page, taskId: string) {
  const card = page.locator(`[data-card-id="${taskId}"]`);
  const task = page.locator(`[data-task-id="${taskId}"], [data-card-id="${taskId}"]`).first();
  await expect(task).toBeVisible();
  if (await card.count()) {
    await card.getByRole('button', { name: /More options/ }).click();
  } else {
    await task.click({ button: 'right' });
  }
  await expect(page.getByRole('menu').first()).toBeVisible();
}

async function chooseColumnRoute(page: Page, status: ApiStatus, route: string, destination: string) {
  await page.getByTestId(`board-column-menu-status:${status.id}`).click();
  await page.getByRole('menuitem', { name: route, exact: true }).click();
  await page.getByRole('menuitem', { name: destination, exact: true }).click();
}

async function expectDatePanelFullyVisible(page: Page) {
  const picker = page.locator('.task-date-picker');
  await expect(picker).toBeVisible();
  await expect.poll(() => picker.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const nav = document.querySelector('.bottom-bar')?.getBoundingClientRect();
    const safeBottom = Math.min(window.innerHeight, nav?.top ?? window.innerHeight) - 8;
    return {
      top: rect.top >= 8,
      left: rect.left >= 8,
      right: rect.right <= window.innerWidth - 8,
      bottom: rect.bottom <= safeBottom,
    };
  })).toEqual({ top: true, left: true, right: true, bottom: true });
  await expect(picker.getByRole('button', { name: 'Save' })).toBeInViewport({ ratio: 1 });
}

test('column rules configure Next, Accept, and Reject and drive task menu moves', async ({ page, api }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });
  const collection = await api.createCollection({ name: name('stage-flows'), color: '#adb9c1' });
  try {
    const [backlog, inProgress, review, completed] = await api.seedStatuses(collection.id);
    const task = await api.createTask({ title: name('stage-task'), collectionId: collection.id });
    await api.moveTask(task.id, {
      parentTaskId: null, collectionId: collection.id, statusId: backlog.id,
      scope: { kind: 'status', collectionId: collection.id, statusId: backlog.id }, position: 0,
    });

    await page.goto(`/collection/${collection.id}`);
    await page.getByRole('button', { name: 'Kanban cards', exact: true }).click();
    await expect(page.getByTestId('board-view')).toBeVisible();
    await chooseColumnRoute(page, backlog, 'Next stage', review.name);
    await expect.poll(async () => (await api.fetchStatuses(collection.id)).find((s) => s.id === backlog.id)?.nextStatusId).toBe(review.id);
    await chooseColumnRoute(page, backlog, 'Accept stage', completed.name);
    await expect.poll(async () => (await api.fetchStatuses(collection.id)).find((s) => s.id === backlog.id)?.acceptStatusId).toBe(completed.id);
    await chooseColumnRoute(page, backlog, 'Reject stage', inProgress.name);
    await expect.poll(async () => (await api.fetchStatuses(collection.id)).find((s) => s.id === backlog.id)?.rejectStatusId).toBe(inProgress.id);
    const viewStatus = (await api.fetchCollectionView(collection.id)).statuses.find((s) => s.id === backlog.id);
    expect(viewStatus).toMatchObject({ nextStatusMode: 'custom', nextStatusId: review.id, acceptStatusId: completed.id, rejectStatusId: inProgress.id });
    await page.reload();
    await expect(page.getByTestId('board-view')).toBeVisible();

    const card = page.locator(`[data-card-id="${task.id}"]`);
    await card.getByRole('button', { name: /More options/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Complete', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: `Move to ${review.name}` })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Accept', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reject', exact: true })).toBeVisible();
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/task-context-board-stage-menu.png' });
    await page.getByRole('menuitem', { name: `Move to ${review.name}` }).click();
    await expect(page.locator(`[data-column-id="status:${review.id}"] [data-card-id="${task.id}"]`)).toBeVisible();
    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.statusId).toBe(review.id);

    await api.moveTask(task.id, {
      parentTaskId: null, collectionId: collection.id, statusId: backlog.id,
      scope: { kind: 'status', collectionId: collection.id, statusId: backlog.id }, position: 0,
    });
    await page.reload();
    await expect(card).toBeVisible();
    await openTaskMenu(page, task.id);
    await page.getByRole('menuitem', { name: 'Accept', exact: true }).click();
    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.isCompleted).toBe(true);
    await expect(page.locator(`[data-column-id="status:${completed.id}"] [data-card-id="${task.id}"]`)).toBeVisible();
    await openTaskMenu(page, task.id);
    await expect(page.getByRole('menuitem', { name: 'Reopen', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Accept', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Reopen', exact: true }).click();
    await api.moveTask(task.id, {
      parentTaskId: null, collectionId: collection.id, statusId: backlog.id,
      scope: { kind: 'status', collectionId: collection.id, statusId: backlog.id }, position: 0,
    });
    await page.reload();
    await openTaskMenu(page, task.id);
    await page.getByRole('menuitem', { name: 'Reject', exact: true }).click();
    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.statusId).toBe(inProgress.id);
    expect(errors).toEqual([]);
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('task actions are available from Daily list, Kanban card, calendar, and Inbox', async ({ page, api }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC', hideCompletedTasks: false });
  const collection = await api.createCollection({ name: name('cross-view'), color: '#adb9c1' });
  const inboxTask = await api.createTask({ title: name('inbox-task') });
  try {
    const [backlog, next] = await api.seedStatuses(collection.id);
    const task = await api.createTask({ title: name('cross-view-task'), collectionId: collection.id, dueDate: today() });
    await api.moveTask(task.id, {
      parentTaskId: null, collectionId: collection.id, statusId: backlog.id,
      scope: { kind: 'status', collectionId: collection.id, statusId: backlog.id }, position: 0,
    });

    await page.goto('/daily/list');
    await openTaskMenu(page, task.id);
    await expect(page.getByRole('menuitem', { name: `Move to ${next.name}` })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Indent', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('menuitem', { name: 'Unindent', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.ui-context-menu-caret')).toHaveCount(1);
    await page.getByRole('menuitem', { name: 'Set date' }).click();
    const picker = page.locator('.task-date-picker');
    await expectDatePanelFullyVisible(page);
    await expect(picker.getByRole('heading', { name: 'Set date' })).toBeVisible();
    await expect(picker.locator('h2 svg')).toHaveCount(0);
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/task-context-date-light-desktop.png' });
    await picker.getByRole('button', { name: 'Close' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await openTaskMenu(page, task.id);
    await page.getByRole('menuitem', { name: 'Set date' }).click();
    await expectDatePanelFullyVisible(page);
    await page.screenshot({ path: 'dist/screenshots/task-context-date-light-narrow.png' });
    await picker.getByRole('button', { name: 'Close' }).click();
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/daily/cards');
    const card = page.locator(`[data-card-id="${task.id}"]`);
    await expect(card).toBeVisible();
    await card.focus();
    await card.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: 'Complete', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/daily/monthly');
    const entry = page.locator('.monthly-ledger').filter({ hasText: task.title }).first();
    await expect(entry).toBeVisible();
    await entry.getByRole('button', { name: new RegExp(`More options.*${task.title}`) }).click();
    await expect(page.getByRole('menuitem', { name: `Move to ${next.name}` })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Complete', exact: true }).click();
    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((entry) => entry.id === task.id)?.isCompleted).toBe(true);

    await page.goto('/inbox');
    await openTaskMenu(page, inboxTask.id);
    await expect(page.getByRole('menuitem', { name: 'Complete', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Complete', exact: true }).click();
    await expect.poll(async () => (await api.get<{ tasks: ApiTask[] }>('/views/inbox')).tasks.find((entry) => entry.id === inboxTask.id)?.isCompleted).toBe(true);
    await openTaskMenu(page, inboxTask.id);
    await page.getByRole('menuitem', { name: 'Reopen', exact: true }).click();
    await expect.poll(async () => (await api.get<{ tasks: ApiTask[] }>('/views/inbox')).tasks.find((entry) => entry.id === inboxTask.id)?.isCompleted).toBe(false);

    await api.patch('/preferences', { background: 'dark' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await openTaskMenu(page, inboxTask.id);
    await expect(page.locator('.ui-context-menu-caret')).toHaveCount(1);
    await page.getByRole('menuitem', { name: 'Set date' }).click();
    await expectDatePanelFullyVisible(page);
    await page.screenshot({ path: 'dist/screenshots/task-context-date-dark-desktop.png' });
    await picker.getByRole('button', { name: 'Close' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await openTaskMenu(page, inboxTask.id);
    await page.getByRole('menuitem', { name: 'Set date' }).click();
    await expectDatePanelFullyVisible(page);
    await page.screenshot({ path: 'dist/screenshots/task-context-date-dark-narrow.png' });
    expect(errors).toEqual([]);
  } finally {
    await api.delete(`/tasks/${inboxTask.id}`).catch(() => undefined);
    await api.deleteCollection(collection.id);
  }
});
