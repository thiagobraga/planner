import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('dragging a child below the next task persists the displayed parent', async ({ api, page }) => {
  const collection = await api.createCollection({ name: `drag-parent-${Date.now()}`, color: '#c9483b' });
  const today = new Date().toISOString().slice(0, 10);
  const first = await api.createTask({ title: 'Computer', collectionId: collection.id, dueDate: today, orderValue: 1000 });
  const second = await api.createTask({ title: 'Pharmacy', collectionId: collection.id, dueDate: today, orderValue: 2000 });
  const child = await api.createTask({ title: 'Medicine', collectionId: collection.id, dueDate: today, parentTaskId: first.id, orderValue: 0 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto('/daily/list');
    const from = page.locator(`[data-task-id="${child.id}"]`);
    const to = page.locator(`[data-task-id="${second.id}"]`);
    await expect(from).toBeVisible();
    // On Saturdays Today is the last day of the week, so the rows land near the viewport edge and the drag autoscrolls
    await from.evaluate((row) => row.scrollIntoView({ block: 'center' }));
    const source = await from.boundingBox();
    const target = await to.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    const x = source!.x + 80;
    const y = source!.y + source!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 12, { steps: 4 });
    await page.mouse.move(x, target!.y + target!.height * 0.4, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => (await api.fetchCollectionView(collection.id)).tasks.find((task) => task.id === child.id)?.parentTaskId).toBe(second.id);
    await page.reload();
    await expect(from).toHaveCSS('padding-left', '24px');
    const order = await page.locator('[data-task-id]').evaluateAll((rows, ids) =>
      rows.map((row) => row.getAttribute('data-task-id')).filter((id) => ids.includes(id ?? '')),
      [first.id, second.id, child.id],
    );
    expect(order).toEqual([first.id, second.id, child.id]);
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: 'dist/screenshots/drag-reparent-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/drag-reparent-mobile.png' });
    expect(errors).toEqual([]);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
