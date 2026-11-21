import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('collapses and expands a parent and a nested child from the keyboard and pointer', async ({ page, api }) => {
  const suffix = Date.now().toString(36).slice(-4);
  const parentName = `Collapse parent ${suffix}`;
  const siblingName = `Collapse sibling ${suffix}`;
  const createdIds: string[] = [];
  try {
    const parent = await api.createCollection({ name: parentName, color: '#c9483b' });
    createdIds.push(parent.id);
    const sibling = await api.createCollection({ name: siblingName, color: '#65788a' });
    createdIds.push(sibling.id);
    const child = await api.createCollection({ name: 'Collapse child', color: '#c9483b', parentId: parent.id });
    await api.createCollection({ name: 'Collapse grandchild', color: '#c9483b', parentId: child.id });
    await api.createCollection({ name: 'Sibling child', color: '#65788a', parentId: sibling.id });
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/collections');
    const layout = page.locator('.collections-layout');
    const tree = page.getByRole('region', { name: 'Collection tree' });
    const parentLink = tree.getByRole('link', { name: parentName });
    const childLink = tree.getByRole('link', { name: 'Collapse child' });
    const grandchildLink = tree.getByRole('link', { name: 'Collapse grandchild' });
    const parentToggle = tree.getByRole('button', { name: `Collapse ${parentName}` });
    const childToggle = tree.getByRole('button', { name: 'Collapse Collapse child' });
    const siblingToggle = tree.getByRole('button', { name: `Collapse ${siblingName}` });
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
    await expect(tree.getByRole('button', { name: `Expand ${parentName}` })).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    await expect(parentLink).toBeVisible();
    await expect(childLink).toBeHidden();

    await tree.getByRole('button', { name: `Expand ${parentName}` }).click();
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
    for (const id of createdIds) await api.deleteCollection(id).catch(() => {});
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
    await expect(tree).toHaveCSS('scrollbar-width', 'auto');
    await expect(tree).toHaveCSS('scrollbar-color', 'auto');
    const thumbColor = () => tree.evaluate((el) => getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor);
    const transparent = 'rgba(0, 0, 0, 0)';
    await page.mouse.move(1270, 490);
    await expect.poll(thumbColor).toBe(transparent);
    await tree.hover();
    await expect.poll(thumbColor).not.toBe(transparent);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => tree.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.mouse.move(1270, 490);
    await expect.poll(thumbColor).toBe(transparent);
    await tree.getByRole('link', { name: 'Column 1', exact: true }).focus();
    await expect.poll(thumbColor).not.toBe(transparent);

    await api.patch('/preferences', { fullWidth: true });
    await page.reload();
    await expect.poll(async () => (await layout.boundingBox())?.width ?? 0).toBeGreaterThan(720);
    await expect.poll(() => layout.evaluate((el) => {
      const main = el.closest('.main-content')!;
      return main.clientWidth - el.getBoundingClientRect().width;
    })).toBe(48);
  } finally {
    await api.patch('/preferences', { fullWidth: false });
    for (const collection of collections) await api.deleteCollection(collection.id);
  }
});
