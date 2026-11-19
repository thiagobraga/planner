import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('collapses and expands a parent and a nested child from the keyboard and pointer', async ({ page, api }) => {
  const parent = await api.createCollection({ name: 'Collapse parent', color: '#c9483b' });
  const sibling = await api.createCollection({ name: 'Collapse sibling', color: '#65788a' });
  try {
    const child = await api.createCollection({ name: 'Collapse child', color: '#c9483b', parentId: parent.id });
    await api.createCollection({ name: 'Collapse grandchild', color: '#c9483b', parentId: child.id });
    await api.createCollection({ name: 'Sibling child', color: '#65788a', parentId: sibling.id });
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/collections');
    const layout = page.locator('.collections-layout');
    const tree = page.getByRole('region', { name: 'Collection tree' });
    const parentLink = tree.getByRole('link', { name: 'Collapse parent' });
    const childLink = tree.getByRole('link', { name: 'Collapse child' });
    const grandchildLink = tree.getByRole('link', { name: 'Collapse grandchild' });
    const parentToggle = tree.getByRole('button', { name: 'Collapse Collapse parent' });
    const childToggle = tree.getByRole('button', { name: 'Collapse Collapse child' });
    const siblingToggle = tree.getByRole('button', { name: 'Collapse Collapse sibling' });
    await expect(grandchildLink).toBeVisible();

    // Toggles float 24px to the left of the collection dot, invisible at rest.
    const layoutBox = (await layout.boundingBox())!;
    const parentToggleBox = (await parentToggle.boundingBox())!;
    const childToggleBox = (await childToggle.boundingBox())!;
    expect(Math.abs(parentToggleBox.x - (layoutBox.x - 24))).toBeLessThan(1);
    expect(Math.abs(childToggleBox.x - layoutBox.x)).toBeLessThan(1);

    await page.mouse.move(1270, 690);
    await expect(parentToggle).toHaveCSS('opacity', '0');
    await expect(childToggle).toHaveCSS('opacity', '0');
    await expect(siblingToggle).toHaveCSS('opacity', '0');

    // Hovering a parent shows only its own toggle; hovering a descendant reveals ancestor toggles too.
    await parentLink.hover();
    await expect(parentToggle).toHaveCSS('opacity', '1');
    await expect(childToggle).toHaveCSS('opacity', '0');
    await expect(siblingToggle).toHaveCSS('opacity', '0');

    await grandchildLink.hover();
    await expect(parentToggle).toHaveCSS('opacity', '1');
    await expect(childToggle).toHaveCSS('opacity', '1');
    await expect(siblingToggle).toHaveCSS('opacity', '0');

    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collections-tree-hover-desktop.png' });

    await childToggle.click();
    await expect(grandchildLink).toBeHidden();
    await expect(childLink).toBeVisible();

    await parentToggle.focus();
    await page.keyboard.press('Enter');
    await expect(childLink).toBeHidden();
    await expect(tree.getByRole('button', { name: 'Expand Collapse parent' })).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    await expect(parentLink).toBeVisible();
    await expect(childLink).toBeHidden();

    await tree.getByRole('button', { name: 'Expand Collapse parent' }).click();
    await expect(childLink).toBeVisible();
    await expect(grandchildLink).toBeHidden();
    await tree.getByRole('button', { name: 'Expand Collapse child' }).press('Space');
    await expect(grandchildLink).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await parentLink.hover();
    await expect(parentToggle).toHaveCSS('opacity', '1');
    const mobileToggleBox = (await parentToggle.boundingBox())!;
    expect(mobileToggleBox.x).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: 'dist/screenshots/collections-tree-hover-mobile.png' });
  } finally {
    await api.deleteCollection(parent.id);
    await api.deleteCollection(sibling.id);
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
    const details = page.getByRole('region', { name: 'Collection details' });
    const heading = tree.getByRole('heading', { name: 'Collections' });
    await expect(layout).toHaveCSS('width', '720px');
    await expect(tree).toHaveCSS('border-right-width', '0px');
    const layoutBox = (await layout.boundingBox())!;
    const detailsBox = (await details.boundingBox())!;
    const topRow = (await page.locator('.topbar-row').boundingBox())!;
    const headingBox = (await heading.boundingBox())!;
    expect(Math.abs(detailsBox.x - layoutBox.x - 192)).toBeLessThan(1);
    expect(Math.abs(layoutBox.x - topRow.x)).toBeLessThan(1);
    expect(Math.abs(headingBox.x - topRow.x)).toBeLessThan(1);

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
