import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import type { ApiTask } from '../src/api/client';

test.use({ storageState: STORAGE_STATE_PATH });

test.beforeEach(async ({ api }) => {
  await api.patch('/preferences', { locale: 'en', navStyle: 'icon-left', background: 'beige' });
});

test('wordmark typography renders on desktop and stays hidden on phones', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');
  const brand = page.locator('.topbar-brand-name');
  await expect(brand).toHaveText('BulletPlanner dev');
  await expect(brand).toHaveCSS('font-weight', '400');
  await expect(brand.locator('b')).toHaveText('Planner');
  await expect(brand.locator('b')).toHaveCSS('font-weight', '600');
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/brand-wordmark-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(brand).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.screenshot({ path: 'dist/screenshots/brand-wordmark-390.png' });
  expect(errors).toEqual([]);
});

test('primary links navigate and mark the current destination', async ({ page }) => {
  await page.goto('/daily/list');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [name, path] of [['Inbox', '/inbox'], ['Habits', '/habits'], ['Collections', '/collections'], ['Daily', '/daily/list']]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main')).toBeVisible();
  }
  await expect(page.locator('.sidebar-drawer, .bottom-bar')).toHaveCount(0);
});

test('style changes persist across reload and arrive in another open tab', async ({ page, context, api }) => {
  await page.goto('/daily/list');
  const other = await context.newPage();
  await other.goto('/inbox');
  await expect(other.locator('[data-nav-style]')).toHaveAttribute('data-nav-style', 'icon-left');
  try {
    await page.getByRole('navigation', { name: 'Main navigation' }).click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Text below' }).click();
    await expect(page.locator('[data-nav-style]')).toHaveAttribute('data-nav-style', 'icon-top');
    await expect(other.locator('[data-nav-style]')).toHaveAttribute('data-nav-style', 'icon-top');
    await page.reload();
    await expect(page.locator('[data-nav-style]')).toHaveAttribute('data-nav-style', 'icon-top');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings/general');
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/topbar-settings-390.png' });
    await page.getByText('Text only', { exact: true }).click();
    await expect.poll(async () => (await api.get<{ navStyle: string }>('/preferences')).navStyle).toBe('text');
    await expect(other.locator('[data-nav-style]')).toHaveAttribute('data-nav-style', 'text');
  } finally {
    await other.close();
  }
});

test('menus toggle, dismiss, restore focus and navigate with the keyboard', async ({ page }) => {
  await page.goto('/daily/list');
  const more = page.getByRole('button', { name: 'Planner menu', exact: true });
  await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await more.click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: /Settings/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(more).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/help$/);
  await more.click();
  await page.getByRole('menuitem', { name: /Keyboard shortcuts/i }).click();
  await expect(page.getByRole('dialog', { name: /Keyboard shortcuts/i })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await more.click();
  await page.locator('main').click({ position: { x: 20, y: 100 } });
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('planner menu hangs from the right edge of its button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');
  const button = page.getByRole('button', { name: 'Planner menu', exact: true });
  const trigger = (await button.boundingBox())!;
  const bar = (await page.locator('.topbar').boundingBox())!;
  await button.click();
  const menu = (await page.getByRole('menu').boundingBox())!;
  expect(Math.abs(menu.x + menu.width - (trigger.x + trigger.width))).toBeLessThanOrEqual(1);
  expect(menu.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  expect(menu.y).toBeLessThanOrEqual(bar.y + bar.height + 12);
});

test('phone planner menu exposes name, version, search and secondary navigation without keyboard hints', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');
  const account = page.getByRole('button', { name: 'Planner menu', exact: true });
  const bar = await page.locator('.topbar').boundingBox();
  expect(Math.round(bar!.y + bar!.height)).toBe(844);
  await expect(page.locator('.topbar').getByRole('link')).toContainText(['Daily', 'Inbox', 'Habits', 'Collections']);
  await expect(account.locator('img.planner-icon-light')).toBeVisible();
  await expect(account).not.toContainText(/\w/);
  await account.click();
  const menu = page.getByRole('menu');
  const menuBox = await menu.boundingBox();
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(bar!.y + 1);
  await page.screenshot({ path: 'dist/screenshots/mobile-nav-menu-390.png' });
  await expect(menu.locator('.topbar-menu-brand')).toContainText('BulletPlanner');
  await expect(menu.locator('.topbar-menu-brand')).toContainText(/v\d+\.\d+\.\d+/);
  await expect(menu.getByRole('menuitem', { name: 'Search', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Help', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Keyboard shortcuts/i })).toHaveCount(0);
  await expect(menu.locator('.ui-context-menu-item-shortcut')).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('page and topbar row share one centered 720px column with a folder tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');
  const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
  const row = await box('.topbar-row');
  const column = await box('.page-container');
  expect(Math.round(column.width)).toBe(720);
  expect(Math.round(row.width)).toBe(720);
  expect(Math.abs(column.x - row.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(column.x - (1440 - column.x - column.width))).toBeLessThanOrEqual(1);
  const bar = await box('.topbar');
  expect(Math.round(bar.width)).toBe(1440);
  const active = page.locator('.topbar-item--active');
  await expect(active).toHaveCSS('border-top-width', '1px');
  await expect(active).toHaveCSS('border-bottom-width', '0px');
  await expect(active).toHaveCSS('border-top-left-radius', '6px');
  const tab = (await active.boundingBox())!;
  expect(Math.round(tab.y + tab.height)).toBe(Math.round(bar.y + bar.height));
  const pageBg = await page.locator('main').evaluate((main) => getComputedStyle(main).backgroundColor);
  await expect(active).toHaveCSS('background-color', pageBg);
  await page.getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Inbox', exact: true })).toHaveClass(/topbar-item--active/);
  await page.goto('/settings/general');
  await expect(page.getByRole('button', { name: 'Planner menu', exact: true })).toHaveAttribute('aria-current', 'page');
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/folder-tab-1440.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');
  const narrow = await box('.page-container');
  expect(narrow.width).toBeLessThan(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('dragging a collection task onto the horizontal Inbox target files it', async ({ page, api }) => {
  const collection = await api.createCollection({ name: `Topbar drag ${Date.now()}`, color: '#c9483b' });
  const task = await api.createTask({ title: 'File through the topbar', collectionId: collection.id });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/collection/${collection.id}`);
    const row = page.locator(`[data-task-id="${task.id}"]`);
    await expect(row).toBeVisible();
    const source = await row.boundingBox();
    const target = await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inbox', exact: true }).boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
    await page.mouse.down();
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2 + 10, { steps: 4 });
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 20 });
    await page.mouse.up();
    await expect.poll(async () => (await api.get<{ tasks: ApiTask[] }>('/views/inbox')).tasks.some((item) => item.id === task.id)).toBe(true);
    await page.reload();
    await expect(page.locator(`[data-task-id="${task.id}"]`)).toHaveCount(0);
  } finally {
    await api.delete(`/tasks/${task.id}`);
    await api.deleteCollection(collection.id);
  }
});

test('wider content and phone routes keep page overflow contained', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/daily/list', '/daily/kanban', '/daily/cards', '/daily/monthly', '/inbox', '/habits', '/collections', '/settings/general', '/help']) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect.poll(() => page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth + 1)).toBe(true);
    }
  }
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/topbar-help-320.png' });
  expect(errors).toEqual([]);
});

test('phone bottom bar stays pinned to the viewport edge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');
  const bar = page.locator('.topbar');
  await expect(bar).toBeVisible();
  const bottomGap = () =>
    bar.evaluate((el) => window.innerHeight - el.getBoundingClientRect().bottom);
  expect(await bottomGap()).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 400));
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  expect(await bottomGap()).toBe(0);
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/bottom-bar-pinned-390.png' });
});

test('phone bar keeps icons and toggles only the labels from its menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');
  const bar = page.locator('.topbar');
  const icon = page.locator('.topbar-item--active .topbar-item-icon');
  const label = page.locator('.topbar-item--active .topbar-item-label');
  await bar.click({ button: 'right', position: { x: 4, y: 4 } });
  const panel = page.locator('.ui-context-menu-panel');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);
  await page.getByRole('menuitemradio', { name: 'Show text' }).click();
  await expect(label).toBeHidden();
  await expect(icon).toBeVisible();
  await bar.click({ button: 'right', position: { x: 4, y: 4 } });
  await page.getByRole('menuitemradio', { name: 'Show text' }).click();
  await expect(label).toBeVisible();
});

test('phone bar icons share one line and each icon group stays centered', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');
  const bar = page.locator('.topbar');
  await expect(bar).toBeVisible();
  const measure = () => bar.evaluate((el) => {
    const box = (node: Element) => node.getBoundingClientRect();
    const centerY = (node: Element) => box(node).top + box(node).height / 2;
    const menuIcon = Array.from(el.querySelectorAll('.topbar-menu-icon')).find((img) => box(img).height > 0)!;
    const tab = el.querySelector('.topbar-item:not(.topbar-item--active)')!;
    const icon = tab.querySelector('.topbar-item-icon')!;
    const label = tab.querySelector('.topbar-item-label')!;
    const groupBottom = box(label).height > 0 ? box(label).bottom : box(icon).bottom;
    return {
      iconCenters: Array.from(el.querySelectorAll('.topbar-item-icon')).map(centerY),
      menuIconCenter: centerY(menuIcon),
      menuButton: { width: box(el.querySelector('.topbar-menu-button')!).width, height: box(el.querySelector('.topbar-menu-button')!).height },
      spaceAbove: box(icon).top - box(tab).top,
      spaceBelow: box(tab).bottom - groupBottom,
      labelPosition: getComputedStyle(label).position,
    };
  });
  for (const labels of ['shown', 'hidden']) {
    await bar.evaluate((el, value) => { el.dataset.phoneLabels = value; }, labels);
    const geometry = await measure();
    for (const center of geometry.iconCenters) expect(Math.abs(center - geometry.menuIconCenter), labels).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.spaceAbove - geometry.spaceBelow), labels).toBeLessThanOrEqual(1);
    expect(geometry.menuButton).toEqual({ width: 36, height: 36 });
    expect(geometry.labelPosition).toBe('static');
  }
});

test('phone bottom bar tabs mirror the desktop folder tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/daily/list');
  const bar = (await page.locator('.topbar').boundingBox())!;
  const active = page.locator('.topbar-item--active');
  await expect(active).toHaveCSS('border-top-width', '0px');
  await expect(active).toHaveCSS('border-bottom-width', '1px');
  await expect(active).toHaveCSS('border-top-left-radius', '0px');
  await expect(active).toHaveCSS('border-bottom-left-radius', '6px');
  const tab = (await active.boundingBox())!;
  expect(Math.round(tab.y)).toBe(Math.round(bar.y));
  const pageBg = await page.locator('main').evaluate((main) => getComputedStyle(main).backgroundColor);
  await expect(active).toHaveCSS('background-color', pageBg);
  await mkdir('dist/screenshots', { recursive: true });
  await page.screenshot({ path: 'dist/screenshots/bottom-bar-folder-tab-390.png' });
});
