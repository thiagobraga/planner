import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('Week selector picks a week from the calendar and returns to today', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.patch('/preferences', { locale: 'en', timeZone: 'UTC' });

  await page.goto('/daily');
  await page.getByRole('button', { name: 'Kanban cards', exact: true }).click();
  await expect(page.getByTestId('daily-week-board')).toBeVisible();

  const nav = page.locator('.daily-week-board-nav');
  const trigger = nav.locator('.week-selector-trigger');
  const currentRange = (await trigger.innerText()).trim();

  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Select week' });
  await expect(dialog).toBeVisible();
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/week-selector-open-desktop.png' });

  await dialog.getByRole('button', { name: 'Next month', exact: true }).click();
  await dialog.getByRole('button', { name: '15', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).not.toHaveText(currentRange);

  await nav.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(trigger).toHaveText(currentRange);

  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await page.screenshot({ path: 'dist/screenshots/week-selector-open-mobile.png' });
  expect(errors).toEqual([]);
});
