/**
 * Regenerates the README feature screenshots in `.github/assets/`.
 *
 * Registers a throwaway account on a running dev stack, seeds fictional data
 * through the API, then captures 3 screens x desktop/mobile x light/dark.
 *
 *   node scripts/readme-screenshots.ts
 *
 * Env: `SCREENSHOT_BASE_URL` (default https://planner.local).
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { APIRequestContext, Browser } from '@playwright/test';

// Playwright is an app dependency; resolve it from there instead of adding a root package.
const { chromium, request: apiRequest } = createRequire(
  path.resolve(import.meta.dirname, '../app/package.json'),
)('@playwright/test') as typeof import('@playwright/test');

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'https://planner.local';
const API = '/api/v1';
const OUT_DIR = path.resolve(import.meta.dirname, '../.github/assets');

const SCREENS = [
  { name: 'daily-list', route: '/daily/list' },
  { name: 'daily-kanban', route: '/daily/cards' },
  // Today is mid-week, so step back one week to show a fully logged row of columns.
  { name: 'habits', route: '/habits', previousWeek: true },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
] as const;

// Theme name used in file names -> the `background` preference that renders it.
const THEMES = { light: 'beige', dark: 'dark' } as const;

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function isoDay(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

async function createAuthedApi(api: APIRequestContext) {
  async function csrfToken(): Promise<string> {
    await api.get(`${API}/collections`);
    const { cookies } = await api.storageState();
    const cookie = cookies.find((c) => c.name.endsWith('_csrf'));
    if (!cookie) throw new Error('Missing CSRF cookie');
    return decodeURIComponent(cookie.value).split(':', 1)[0] as string;
  }

  async function send<T>(method: string, route: string, data?: Json): Promise<T> {
    const response = await api.fetch(`${API}${route}`, {
      method,
      data,
      headers: { 'X-XSRF-TOKEN': await csrfToken() },
      failOnStatusCode: false,
    });
    if (!response.ok()) {
      throw new Error(`${method} ${route}: ${response.status()} ${await response.text()}`);
    }
    return (response.status() === 204 ? undefined : await response.json()) as T;
  }

  return {
    post: <T>(route: string, data?: Json) => send<T>('POST', route, data),
    patch: <T>(route: string, data?: Json) => send<T>('PATCH', route, data),
    put: <T>(route: string, data?: Json) => send<T>('PUT', route, data),
  };
}

type Api = Awaited<ReturnType<typeof createAuthedApi>>;

async function seed(api: Api): Promise<void> {
  await api.patch('/preferences', {
    locale: 'en',
    timeZone: 'UTC',
    weekStart: 'monday',
    hideCompletedTasks: false,
  });

  const home = await api.post<{ id: string }>('/collections', { name: 'Home', color: '#c9483b' });
  const work = await api.post<{ id: string }>('/collections', { name: 'Work', color: '#5b7c99' });
  const garden = await api.post<{ id: string }>('/collections', { name: 'Garden', color: '#6b8f5e' });

  const tasks: Array<{ title: string; day: number; collectionId?: string; priority?: number; done?: boolean }> = [
    { title: 'Plan the week', day: 0, collectionId: work.id, priority: 1 },
    { title: 'Reply to Sam about the venue', day: 0, collectionId: work.id },
    { title: 'Buy tomato seedlings', day: 0, collectionId: garden.id },
    { title: 'Water the herbs', day: 0, collectionId: garden.id, done: true },
    { title: 'Book dentist appointment', day: 0, collectionId: home.id, priority: 2 },
    { title: 'Draft the Q4 roadmap', day: 1, collectionId: work.id, priority: 1 },
    { title: 'Pick up dry cleaning', day: 1, collectionId: home.id },
    { title: 'Team retro notes', day: 2, collectionId: work.id },
    { title: 'Repot the monstera', day: 2, collectionId: garden.id },
    { title: 'Call mom', day: 3, collectionId: home.id, priority: 2 },
    { title: 'Review pull requests', day: 3, collectionId: work.id },
    { title: 'Meal prep for Sunday', day: 4, collectionId: home.id },
    { title: 'Prune the roses', day: 5, collectionId: garden.id },
    { title: 'Send the invoice', day: -2, collectionId: work.id, priority: 1 },
    { title: 'Renew library books', day: -1, collectionId: home.id },
  ];

  for (const { title, day, collectionId, priority, done } of tasks) {
    const task = await api.post<{ id: string }>('/tasks', {
      title,
      collectionId,
      priority,
      dueDate: isoDay(day),
    });
    if (done) await api.post(`/tasks/${task.id}/complete`, {});
  }

  const morning = await api.post<{ id: string }>('/habit-groups', { name: 'Morning' });
  const evening = await api.post<{ id: string }>('/habit-groups', { name: 'Evening' });

  // Pass rate per habit; a fixed pseudo-random sequence keeps the grid stable between runs.
  const habits = [
    { name: 'Walk 8,000 steps', groupId: null, rate: 0.5 },
    { name: 'Meditate 10 minutes', groupId: morning.id, rate: 0.85 },
    { name: 'Stretch', groupId: morning.id, rate: 0.7 },
    { name: 'Read 20 pages', groupId: evening.id, rate: 0.6 },
    { name: 'Journal', groupId: evening.id, rate: 0.9 },
  ];

  let seedState = 7;
  const next = () => {
    seedState = (seedState * 16807) % 2147483647;
    return seedState / 2147483647;
  };

  for (const { name, groupId, rate } of habits) {
    const habit = await api.post<{ id: string }>('/habits', { name, groupId });
    for (let day = -83; day <= 0; day++) {
      if (next() < rate) {
        await api.put(`/habits/${habit.id}/completions`, { date: isoDay(day), isCompleted: true });
      }
    }
  }
}

async function capture(
  browser: Browser,
  storageState: Awaited<ReturnType<APIRequestContext['storageState']>>,
  theme: keyof typeof THEMES,
): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      storageState,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.mobile ? 2 : 1,
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      reducedMotion: 'reduce',
      // Habits and Daily must agree on "today" with the account's UTC time zone.
      timezoneId: 'UTC',
    });
    const page = await context.newPage();

    for (const screen of SCREENS) {
      await page.goto(screen.route);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      if ('previousWeek' in screen) {
        await page.getByRole('button', { name: 'Previous week', exact: true }).click();
        await page.waitForLoadState('networkidle');
      }
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUT_DIR, `${screen.name}-${viewport.name}-${theme}.png`),
      });
    }
    await context.close();
  }
}

async function main(): Promise<void> {
  const origin = new URL(BASE_URL).origin;
  const api = await apiRequest.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const email = `readme-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  await api.post(`${API}/auth/register`, {
    data: { email, password, displayName: 'Alex Morgan', timeZone: 'UTC' },
  });
  await api.post(`${API}/auth/login`, { data: { email, password } });

  const authed = await createAuthedApi(api);
  await seed(authed);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--no-sandbox'],
  });
  try {
    // Theme is a stored preference, so flip it between passes instead of relying on the OS scheme.
    for (const [theme, background] of Object.entries(THEMES) as Array<[keyof typeof THEMES, string]>) {
      await authed.patch('/preferences', { background });
      await capture(browser, await api.storageState(), theme);
    }
  } finally {
    await browser.close();
    await api.dispose();
  }
}

await main();
