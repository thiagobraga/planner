import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('supports split panes, dot color picker, clean inline inputs and collection title children menu', async ({ page, api }) => {
  const work = await api.createCollection({ name: 'Work split', color: '#c9483b' });
  const home = await api.createCollection({ name: 'Home split', color: '#65788a' });
  try {
    await api.createCollection({ name: 'Design sub', color: '#b08b8a', parentId: work.id });
    await api.createTask({ title: 'Work task', collectionId: work.id });
    await api.createTask({ title: 'Home task', collectionId: home.id });

    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto(`/collection/${work.id}`);

    const tree = page.getByRole('region', { name: 'Collection tree' });
    const detail = page.getByRole('region', { name: 'Collection details' });
    await expect(detail.getByRole('heading', { name: 'Work split' })).toBeVisible();

    // 1. Clicking collection name on detail page opens children + add sub-collection menu.
    await detail.getByRole('button', { name: 'Work split' }).click();
    const titleMenu = page.getByRole('menu');
    await expect(titleMenu.getByRole('menuitem', { name: 'Design sub' })).toBeVisible();
    await expect(titleMenu.getByRole('menuitem', { name: 'Add sub-collection' })).toBeVisible();
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/collections-header-menu-desktop.png' });
    await titleMenu.getByRole('menuitem', { name: 'Design sub' }).click();
    await expect(detail.getByRole('heading', { name: /Design sub/ })).toBeVisible();

    await tree.getByRole('link', { name: 'Work split' }).click();
    await expect(detail.getByRole('heading', { name: 'Work split' })).toBeVisible();

    // 2. Clicking the collection circle in the tree opens the color picker.
    const workRow = tree.locator('.collections-index-row', { hasText: 'Work split' }).first();
    await workRow.getByRole('button', { name: 'Change color…' }).click();
    const picker = page.getByRole('dialog', { name: 'Change color' });
    await expect(picker).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);

    // 3. Inline add-child and add-root inputs stay on 24px rows without a focus outline box.
    await workRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add sub-collection' }).click();
    const subInput = tree.getByPlaceholder('Collection name…');
    await expect(subInput).toBeFocused();
    await expect(subInput).toHaveCSS('outline-style', 'none');
    await page.screenshot({ path: 'dist/screenshots/collections-add-child-desktop.png' });
    await subInput.press('Escape');

    await tree.getByRole('button', { name: 'Add collection' }).click();
    const rootInput = tree.getByPlaceholder('Collection name…');
    await expect(rootInput).toBeFocused();
    await expect(rootInput).toHaveCSS('outline-style', 'none');
    await page.screenshot({ path: 'dist/screenshots/collections-add-root-desktop.png' });
    await rootInput.press('Escape');

    // 4. Right-click -> Split vertically and Split horizontally.
    const homeRow = tree.locator('.collections-index-row', { hasText: 'Home split' }).first();
    await homeRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split vertically' }).click();
    await expect(detail).toHaveAttribute('data-split', 'vertical');
    await expect(detail.getByRole('heading', { name: 'Work split' })).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Home split' })).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/collections-split-vertical-desktop.png' });

    await homeRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split horizontally' }).click();
    await expect(detail).toHaveAttribute('data-split', 'horizontal');
    await page.screenshot({ path: 'dist/screenshots/collections-split-horizontal-desktop.png' });

    const closeButtons = detail.getByRole('button', { name: 'Close pane' });
    await closeButtons.last().click();
    await detail.getByRole('button', { name: 'Close pane' }).last().click();
    await expect(detail).not.toHaveAttribute('data-split');
  } finally {
    await api.deleteCollection(work.id);
    await api.deleteCollection(home.id);
  }
});
