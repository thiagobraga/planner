import crypto from 'node:crypto';
import type { Page } from '@playwright/test';

import type { ApiStatus, ApiTask } from '../../../src/api/client';
import {
  expect,
  test,
  STORAGE_STATE_PATH,
  type AuthedApi,
} from '../../fixtures/api';

export { expect, STORAGE_STATE_PATH, test };

export function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function openBoard(page: Page, collectionId: string): Promise<void> {
  await page.goto(`/collection/${collectionId}`);
  await expect(page.getByRole('button', { name: 'Kanban' })).toBeVisible();
  await expect(async () => {
    const kanban = page.getByRole('button', { name: 'Kanban' });
    if (await kanban.getAttribute('aria-pressed') !== 'true') {
      await kanban.click();
    }
    await expect(page.getByTestId('board-view')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 10_000 });
}

export async function setGroupBy(page: Page, label: 'Status' | 'Section' | 'Priority'): Promise<void> {
  const select = page.locator('#board-group-by');
  await select.click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(select).toContainText(label);
}

export function statusColumn(page: Page, statusId: string) {
  return page.locator(`[data-column-id="status:${statusId}"]`);
}

export function priorityColumn(page: Page, priority: number) {
  return page.locator(`[data-column-id="priority:${priority}"]`);
}

export function card(page: Page, taskId: string) {
  return page.locator(`[data-card-id="${taskId}"]`);
}

export async function moveToStatus(
  api: AuthedApi,
  task: ApiTask,
  status: ApiStatus,
  position = 0,
): Promise<void> {
  await api.moveTask(task.id, {
    parentTaskId: null,
    collectionId: task.collectionId,
    statusId: status.id,
    scope: {
      kind: 'status',
      collectionId: task.collectionId,
      statusId: status.id,
    },
    position,
  });
}
