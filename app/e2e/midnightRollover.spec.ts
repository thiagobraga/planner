import { mkdir } from 'node:fs/promises';
import { test, expect, STORAGE_STATE_PATH } from './fixtures/api';
import type { Preferences } from '../src/types/api';

const TZ = 'America/Sao_Paulo';
// REAL_MIDNIGHT=1 keeps the real clock and waits for the actual midnight instead of faking it.
const REAL = process.env.REAL_MIDNIGHT === '1';

test.use({ storageState: STORAGE_STATE_PATH, timezoneId: TZ, locale: 'pt-BR' });

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

// The Playwright user is shared by every spec, so the preferences this one changes must not leak.
let originalPreferences: Pick<Preferences, 'locale' | 'timeZone' | 'weekStart' | 'hideCompletedTasks'>;

test.afterEach(async ({ api }) => {
  await api.patch('/preferences', originalPreferences);
});

test('Today marker moves to the next day at midnight in every view', async ({ context, api }) => {
  test.setTimeout(REAL ? 30 * 60_000 : 90_000);
  const { locale, timeZone, weekStart, hideCompletedTasks } = await api.get<Preferences>('/preferences');
  originalPreferences = { locale, timeZone, weekStart, hideCompletedTasks };
  await api.patch('/preferences', { locale: 'pt-BR', timeZone: TZ, weekStart: 'sunday', hideCompletedTasks: false });

  // The fake clock only affects the pages, so the node side derives its days from the same start.
  const start = REAL ? new Date() : new Date('2026-10-16T23:59:45-03:00');
  if (!REAL) await context.clock.install({ time: start });
  const before = dayKey(start);
  const after = dayKey(new Date(start.getTime() + 86_400_000));
  const beforeDay = Number(before.slice(8));
  const afterDay = Number(after.slice(8));

  const views = {
    list: await context.newPage(),
    kanban: await context.newPage(),
    monthly: await context.newPage(),
    habits: await context.newPage(),
  };
  const errors: string[] = [];
  for (const page of Object.values(views)) page.on('pageerror', (e) => errors.push(e.message));

  await views.list.goto('/daily/list');
  await views.kanban.goto('/daily/kanban');
  await views.monthly.goto('/daily/monthly');
  await views.habits.goto('/habits');

  const listToday = (date: string) => views.list.locator(`[data-day-date="${date}"]`).getByText('Hoje', { exact: true });
  const kanbanToday = views.kanban.locator('[data-today]');
  const monthlyToday = views.monthly.locator('.monthly-current-day-label').first();
  const habitsToday = views.habits.locator('.habit-timeline-today-col, .habit-month-grid-cell-today').first();

  await expect(listToday(before)).toBeVisible();
  await expect(kanbanToday).toHaveCount(1);
  await expect(kanbanToday).toContainText('Hoje');
  await expect(monthlyToday).toContainText(String(beforeDay));
  await expect(habitsToday).toBeVisible();
  await expect(habitsToday).toContainText(String(beforeDay));
  const kanbanBefore = await kanbanToday.innerText();

  await mkdir('dist/screenshots', { recursive: true });
  for (const [name, page] of Object.entries(views)) {
    await page.screenshot({ path: `dist/screenshots/midnight-${name}-before.png` });
  }

  if (REAL) {
    await views.list.waitForTimeout(Math.max(0, new Date(`${after}T00:00:05-03:00`).getTime() - Date.now()));
  } else {
    await context.clock.runFor(20_000);
  }

  const results: Record<string, string> = {};
  const check = async (name: string, assertion: () => Promise<void>) => {
    try {
      await assertion();
      results[name] = 'PASS';
    } catch (error) {
      results[name] = `FAIL ${(error as Error).message.split('\n')[0]}`;
    }
  };

  await check('list', async () => {
    await expect(listToday(after)).toBeVisible({ timeout: 5_000 });
    await expect(listToday(before)).toHaveCount(0);
  });
  await check('kanban', async () => {
    await expect(kanbanToday).toHaveCount(1, { timeout: 5_000 });
    await expect(kanbanToday).not.toHaveText(kanbanBefore);
    await expect(kanbanToday).toContainText(String(afterDay));
  });
  await check('monthly', async () => {
    await expect(monthlyToday).toContainText(String(afterDay), { timeout: 5_000 });
    const labels = await views.monthly.locator('.monthly-current-day-label').allInnerTexts();
    expect(labels.map((l) => l.trim()), `highlighted labels: ${JSON.stringify(labels)}`).not.toContain(String(beforeDay));
  });
  await check('habits', async () => {
    await expect(habitsToday).toContainText(String(afterDay), { timeout: 5_000 });
  });

  for (const [name, page] of Object.entries(views)) {
    await page.screenshot({ path: `dist/screenshots/midnight-${name}-after.png` });
  }
  console.log(`MIDNIGHT RESULTS ${JSON.stringify(results, null, 2)}`);
  expect(errors).toEqual([]);
  expect(Object.values(results).filter((r) => r !== 'PASS')).toEqual([]);
});
