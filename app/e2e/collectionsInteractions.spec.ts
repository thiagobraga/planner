import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('supports split panes, dot color picker, clean inline inputs and collection title children menu', async ({ page, api }) => {
  const suffix = Date.now().toString(36).slice(-4);
  const workName = `Work split ${suffix}`;
  const homeName = `Home split ${suffix}`;
  const subName = `Design sub ${suffix}`;
  const createdIds: string[] = [];

  try {
    const work = await api.createCollection({ name: workName, color: '#c9483b' });
    createdIds.push(work.id);
    const home = await api.createCollection({ name: homeName, color: '#65788a' });
    createdIds.push(home.id);
    await api.createCollection({ name: subName, color: '#b08b8a', parentId: work.id });
    await api.createTask({ title: 'Work task', collectionId: work.id });
    await api.createTask({ title: 'Home task', collectionId: home.id });

    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto(`/collection/${work.id}`);

    const tree = page.getByRole('region', { name: 'Collection tree' });
    const detail = page.getByRole('region', { name: 'Collection details' });
    await expect(detail.getByRole('heading', { name: workName })).toBeVisible();

    // 1. Clicking collection name on detail page opens children + add sub-collection menu.
    await detail.getByRole('button', { name: workName, exact: true }).click();
    const titleMenu = page.getByRole('menu');
    await expect(titleMenu.getByRole('menuitem', { name: subName })).toBeVisible();
    await expect(titleMenu.getByRole('menuitem', { name: 'Add sub-collection' })).toBeVisible();
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collections-header-menu-desktop.png' });
    await titleMenu.getByRole('menuitem', { name: subName }).click();
    await expect(detail.getByRole('heading', { name: new RegExp(subName) })).toBeVisible();

    await tree.getByRole('link', { name: workName }).click();
    await expect(detail.getByRole('heading', { name: workName })).toBeVisible();

    // 2. Clicking the collection circle in the tree opens the color picker.
    const workRow = tree.locator('.collections-index-row', { hasText: workName });
    await workRow.getByRole('button', { name: `Change color for ${workName}` }).click();
    const picker = page.getByRole('dialog', { name: 'Change color' });
    await expect(picker).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);

    // 3. Inline add-child and add-root inputs stay on 24px rows without a focus outline box.
    await workRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add sub-collection' }).click();
    const subInput = tree.getByRole('textbox', { name: 'Collection name…' });
    await expect(subInput).toBeFocused();
    await expect(subInput).toHaveCSS('outline-style', 'none');
    await page.screenshot({ path: 'dist/screenshots/collections-add-child-desktop.png' });
    await subInput.press('Escape');

    await tree.getByRole('button', { name: 'Add collection' }).click();
    const rootInput = tree.getByRole('textbox', { name: 'Collection name…' });
    await expect(rootInput).toBeFocused();
    await expect(rootInput).toHaveCSS('outline-style', 'none');
    await page.screenshot({ path: 'dist/screenshots/collections-add-root-desktop.png' });
    await rootInput.press('Escape');

    // 4. Right-click -> Split vertically, switch to Split horizontally, then close primary pane.
    const homeRow = tree.locator('.collections-index-row', { hasText: homeName });
    await homeRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split vertically' }).click();
    await expect(detail).toHaveAttribute('data-split', 'vertical');
    await expect(detail.getByRole('heading', { name: workName })).toBeVisible();
    await expect(detail.getByRole('heading', { name: homeName })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Close pane' })).toHaveCount(2);
    await page.screenshot({ path: 'dist/screenshots/collections-split-vertical-desktop.png' });

    await homeRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split horizontally' }).click();
    await expect(detail).toHaveAttribute('data-split', 'horizontal');
    await expect(detail.getByRole('button', { name: 'Close pane' })).toHaveCount(2);
    await page.screenshot({ path: 'dist/screenshots/collections-split-horizontal-desktop.png' });

    await detail.getByRole('button', { name: 'Close pane' }).first().click();
    await expect(detail).not.toHaveAttribute('data-split');
    await expect(detail.getByRole('heading', { name: homeName })).toBeVisible();
  } finally {
    for (const id of createdIds) await api.deleteCollection(id).catch(() => {});
  }
});
