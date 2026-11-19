import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('keeps the desktop tree and rename draft across navigation and history', async ({ page, api }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  const collections = [];
  for (let index = 1; index <= 6; index++) {
    collections.push(await api.createCollection({ name: `Split view ${index}`, color: '#c9483b' }));
  }
  try {
    await api.createTask({ title: 'Plan the next release', collectionId: collections[5].id });
    await page.goto('/collections');
    const tree = page.getByRole('region', { name: 'Collection tree' });
    const pane = page.getByRole('region', { name: 'Collection details' });
    await expect(pane.getByRole('heading', { name: 'Select a collection' })).toBeVisible();
    const layoutBox = (await page.locator('.collections-layout').boundingBox())!;
    const paneBox = (await pane.boundingBox())!;
    expect(Math.abs(paneBox.x - layoutBox.x - 192)).toBeLessThan(1);
    await expect(tree.locator('a[aria-current="page"]')).toHaveCount(0);
    await tree.evaluate((el) => { el.dataset.testInstance = 'original'; });
    const first = tree.getByRole('link', { name: 'Split view 1' });
    await first.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const draft = tree.getByRole('textbox', { name: 'Collection name…' });
    await draft.fill('Unfinished rename');

    const fetched = new Map<string, number>();
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/v1/views/collection/')) fetched.set(path, (fetched.get(path) ?? 0) + 1);
    });
    for (let index = 2; index <= 6; index++) {
      const row = tree.getByRole('link', { name: `Split view ${index}` });
      await row.click();
      await expect(pane.getByRole('heading', { name: `Split view ${index}`, exact: true })).toBeVisible();
      await expect(row).toBeFocused();
      await expect(row).toHaveAttribute('aria-current', 'page');
      await expect(tree).toHaveAttribute('data-test-instance', 'original');
      await expect(draft).toHaveValue('Unfinished rename');
    }
    expect([...fetched.values()]).toEqual([1, 1, 1, 1, 1]);
    await tree.getByRole('link', { name: 'Split view 6' }).click();
    await page.goBack();
    await expect(tree.getByRole('link', { name: 'Split view 5' })).toHaveAttribute('aria-current', 'page');
    await page.goForward();
    await expect(tree.getByRole('link', { name: 'Split view 6' })).toHaveAttribute('aria-current', 'page');
    await draft.press('Escape');
    await first.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    const last = tree.getByRole('link', { name: 'Split view 6' });
    await last.click({ position: { x: 8, y: 12 } });
    await expect(page.getByRole('menu')).toBeVisible();
    await tree.getByRole('link', { name: 'Split view 5' }).click({ position: { x: 8, y: 12 } });
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(pane.getByRole('heading', { name: 'Split view 5' })).toBeVisible();
    await pane.getByRole('heading', { name: 'Split view 5' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 240 });
    await tree.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const scrollTop = await tree.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    await last.click();
    await expect(pane.getByRole('heading', { name: 'Split view 6' })).toBeVisible();
    expect(await tree.evaluate((el) => el.scrollTop)).toBe(scrollTop);
    await page.setViewportSize({ width: 1280, height: 700 });


    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collections-split-desktop.png' });
  } finally {
    for (const collection of collections) await api.deleteCollection(collection.id);
  }
});

test('opens a deep link on mobile and returns to the list', async ({ page, api }) => {
  const collection = await api.createCollection({ name: 'Mobile collection', color: '#c9483b' });
  try {
    await api.createTask({ title: 'Review the notebook', collectionId: collection.id });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/collection/${collection.id}`);
    const pane = page.getByRole('region', { name: 'Collection details' });
    await expect(pane.getByRole('heading', { name: 'Mobile collection' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Collection tree' })).toHaveCount(0);
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collections-split-mobile.png' });
    await pane.getByRole('link', { name: 'Back to collections' }).click();
    await expect(page).toHaveURL(/\/collections$/);
    await expect(page.getByRole('region', { name: 'Collection tree' }).getByRole('link', { name: 'Mobile collection' })).toBeVisible();
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('updates the selected view when API clients change tasks, sections or the collection', async ({ page, api }) => {
  const collection = await api.createCollection({ name: 'Live collection', color: '#c9483b' });
  try {
    await page.goto(`/collection/${collection.id}`);
    const pane = page.getByRole('region', { name: 'Collection details' });
    await expect(pane.getByRole('heading', { name: 'Live collection' })).toBeVisible();
    await api.createTask({ title: 'Live task', collectionId: collection.id });
    await expect(pane.getByText('Live task', { exact: true })).toBeVisible();
    const section = await api.post<{ id: string }>(`/collections/${collection.id}/sections`, { name: 'Live section' });
    await expect(pane.getByLabel('Live section', { exact: true })).toBeVisible();
    await api.patch(`/sections/${section.id}`, { name: 'Renamed section' });
    await expect(pane.getByLabel('Renamed section', { exact: true })).toBeVisible();
    await api.delete(`/sections/${section.id}`);
    await expect(pane.getByLabel('Renamed section', { exact: true })).toHaveCount(0);
    await api.patch(`/collections/${collection.id}`, { name: 'Renamed collection' });
    await expect(pane.getByRole('heading', { name: 'Renamed collection' })).toBeVisible();
    await api.post(`/collections/${collection.id}/archive`);
    await expect(page).toHaveURL(/\/collections$/);
    await expect(pane.getByRole('heading', { name: 'Select a collection' })).toBeVisible();
  } finally {
    await api.deleteCollection(collection.id);
  }
});

test('deleting the open collection returns to the landing pane', async ({ page, api }) => {
  const collection = await api.createCollection({ name: 'Collection to delete', color: '#c9483b' });
  let deleted = false;
  try {
    await page.goto(`/collection/${collection.id}`);
    const tree = page.getByRole('region', { name: 'Collection tree' });
    await expect(tree.getByRole('link', { name: collection.name })).toHaveAttribute('aria-current', 'page');
    await api.deleteCollection(collection.id);
    deleted = true;
    await expect(page).toHaveURL(/\/collections$/);
    await expect(tree.getByRole('link', { name: collection.name })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Select a collection' })).toBeVisible();
  } finally {
    if (!deleted) await api.deleteCollection(collection.id);
  }
});

test('a phone long press opens collection actions without following the link', async ({ page, context, api }) => {
  const collection = await api.createCollection({ name: 'Collection long press', color: '#c9483b' });
  const cdp = await context.newCDPSession(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await page.goto('/collections');
    const row = page.getByRole('link', { name: collection.name, exact: true });
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await expect(page.getByRole('menu')).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page).toHaveURL(/\/collections$/);
  } finally {
    await cdp.detach();
    await api.deleteCollection(collection.id);
  }
});

test('missing collections keep the tree visible and disclose no collection name', async ({ page }) => {
  for (const id of ['not-a-collection', 'ea712188-ba65-4a2c-9e36-a8f3934f2442']) {
    await page.goto(`/collection/${id}`);
    await expect(page.getByRole('region', { name: 'Collection tree' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Collection not found' })).toBeVisible();
  }
});
