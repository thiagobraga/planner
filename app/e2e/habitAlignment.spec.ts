import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('habit names and group heading align with New habit', async ({ page, api }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await api.post('/habits', { name: 'Drink water' });
  const group = await api.post<{ id: string }>('/habit-groups', { name: 'Morning routine' });
  await api.patch(`/habit-groups/${group.id}`, { icon: '☀️' });

  await page.goto('/habits');
  const habit = page.locator('.habit-timeline-row-name').filter({ hasText: 'Drink water' });
  const newHabit = page.locator('.habit-timeline-add-habit span:last-child').first();
  const groupName = page.locator('.habit-timeline-group-name').filter({ hasText: 'Morning routine' });
  await expect(habit).toBeVisible();
  await expect(newHabit).toBeVisible();
  await expect(groupName).toBeVisible();
  await expect(page.locator('.habit-timeline-group-header .habit-group-icon')).toHaveCount(0);

  await mkdir('dist/screenshots', { recursive: true });
  for (const [width, height, name] of [[1280, 800, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    const habitBox = await habit.boundingBox();
    const newBox = await newHabit.boundingBox();
    const groupBox = await groupName.boundingBox();
    expect(habitBox?.x).toBeCloseTo(newBox!.x, 0);
    expect(groupBox?.x).toBeCloseTo(newBox!.x, 0);
    await page.screenshot({ path: `dist/screenshots/habit-alignment-${name}.png` });
  }
  expect(errors).toEqual([]);
});
