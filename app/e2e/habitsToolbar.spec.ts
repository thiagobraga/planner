import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('habits show the whole week with week navigation in the page toolbar', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await api.post('/habits', { name: `Week habit ${Date.now()}` });
  await mkdir('dist/screenshots', { recursive: true });

  for (const [width, height, name] of [[1280, 800, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/habits');
    await page.evaluate(() => localStorage.setItem('planner.habits.view.v1', 'timeline'));
    await page.reload();

    const toolbar = name === 'mobile' ? page.getByTestId('page-toolbar-mobile') : page.locator('header .page-toolbar');
    await expect(toolbar.getByLabel('Timeline view')).toBeVisible();
    const range = toolbar.locator('.date-nav-trigger');
    const before = await range.textContent();

    const days = page.locator('.habit-timeline-header-day');
    await expect(days).toHaveCount(7);
    for (const box of await days.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) {
      expect(box).toBeLessThanOrEqual(width);
    }
    await expect(page.locator('.habit-timeline .opacity-40')).toHaveCount(0);
    await page.screenshot({ path: `dist/screenshots/habits-toolbar-${name}.png` });

    await toolbar.getByLabel('Next').click();
    await expect(range).not.toHaveText(before ?? '');
  }
  expect(errors).toEqual([]);
});
