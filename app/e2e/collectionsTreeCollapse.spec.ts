import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('collapses and expands a parent and a nested child from the keyboard and pointer', async ({ page, api }) => {
  const parent = await api.createCollection({ name: 'Collapse parent', color: '#c9483b' });
  try {
    const child = await api.createCollection({ name: 'Collapse child', color: '#c9483b', parentId: parent.id });
    await api.createCollection({ name: 'Collapse grandchild', color: '#c9483b', parentId: child.id });
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/collections');
    const tree = page.getByRole('region', { name: 'Collection tree' });
    const childLink = tree.getByRole('link', { name: 'Collapse child' });
    const grandchildLink = tree.getByRole('link', { name: 'Collapse grandchild' });
    await expect(grandchildLink).toBeVisible();

    await tree.getByRole('button', { name: 'Collapse Collapse child' }).click();
    await expect(grandchildLink).toBeHidden();
    await expect(childLink).toBeVisible();

    const parentToggle = tree.getByRole('button', { name: 'Collapse Collapse parent' });
    await parentToggle.focus();
    await page.keyboard.press('Enter');
    await expect(childLink).toBeHidden();
    await expect(tree.getByRole('button', { name: 'Expand Collapse parent' })).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    await expect(tree.getByRole('link', { name: 'Collapse parent' })).toBeVisible();
    await expect(childLink).toBeHidden();

    await tree.getByRole('button', { name: 'Expand Collapse parent' }).click();
    await expect(childLink).toBeVisible();
    await expect(grandchildLink).toBeHidden();
    await tree.getByRole('button', { name: 'Expand Collapse child' }).press('Space');
    await expect(grandchildLink).toBeVisible();
  } finally {
    await api.deleteCollection(parent.id);
  }
});

test('the split view follows the page column and the tree stays flat and quiet', async ({ page, api }) => {
  const collections = [];
  for (let index = 1; index <= 30; index++) {
    collections.push(await api.createCollection({ name: `Column ${index}`, color: '#c9483b' }));
  }
  try {
    await page.setViewportSize({ width: 1280, height: 500 });
    await api.patch('/preferences', { fullWidth: false });
    await page.goto('/collections');
    const layout = page.locator('.collections-layout');
    const tree = page.getByRole('region', { name: 'Collection tree' });
    await expect(tree).toHaveCSS('width', '264px');
    await expect(layout).toHaveCSS('width', '720px');
    const topRow = await page.locator('.topbar-row').boundingBox();
    expect(Math.abs((await layout.boundingBox())!.x - topRow!.x)).toBeLessThan(1);

    await expect(tree).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(tree).toHaveCSS('scrollbar-gutter', 'stable');
    await page.mouse.move(1270, 490);
    await expect(tree).toHaveCSS('scrollbar-color', 'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)');
    await tree.hover();
    await expect(tree).not.toHaveCSS('scrollbar-color', 'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)');
    await page.mouse.wheel(0, 200);
    await expect.poll(() => tree.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await api.patch('/preferences', { fullWidth: true });
    await page.reload();
    const main = await page.locator('.main-content').evaluate((el) => el.clientWidth);
    await expect.poll(async () => (await layout.boundingBox())!.width).toBeGreaterThan(720);
    expect((await layout.boundingBox())!.width).toBe(main - 48);
  } finally {
    await api.patch('/preferences', { fullWidth: false });
    for (const collection of collections) await api.deleteCollection(collection.id);
  }
});
