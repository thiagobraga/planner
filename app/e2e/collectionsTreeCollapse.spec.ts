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
