import type { ApiStatus } from '../../../src/api/client';
import { expect, openBoard, STORAGE_STATE_PATH, test, uniqueName } from './helpers';

test.use({ storageState: STORAGE_STATE_PATH });

// Development-home golden path: an imported plan is one card whose preview caps
// at five rows, and Show all opens the panel on the whole task tree.
test('an imported plan shows five subtasks on its card and the full tree in Only tasks', async ({ api, page }) => {
  const collection = await api.createCollection({ name: uniqueName('import-golden'), color: '#adb9c1' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await api.post<ApiStatus[]>(`/collections/${collection.id}/statuses/seed`);
    const plan = [
      '# Goal',
      'Write the plan where the work is.',
      '- [x] One',
      '- [ ] Two',
      '  - [ ] Two child',
      '- [ ] Three',
      '- [ ] Four',
      '- [ ] Five',
      '- [ ] Six',
      'Closing note.',
    ].join('\n');
    const title = uniqueName('Imported plan');
    const body = { sourcePath: `.specs/${title}`, title, plan, collectionId: collection.id };

    const preview = await api.post<{ subtasks: number; warnings: string[] }>('/imports/markdown/preview', body);
    expect(preview).toMatchObject({ subtasks: 7, warnings: [] });
    const imported = await api.post<{ rootTaskId: string; manifestId: string }>('/imports/markdown', body);

    await openBoard(page, collection.id);
    const card = page.locator(`[data-card-id="${imported.rootTaskId}"]`);
    await expect(card.getByRole('heading', { name: title })).toBeVisible();
    await expect(card.locator('.board-card-checklist-row')).toHaveCount(5);
    await expect(card.getByText('1 of 6')).toBeVisible();

    await card.getByRole('button', { name: 'Show all 6 subtasks' }).click();
    const panel = page.getByRole('complementary', { name: 'Task details' });
    await expect(panel.getByRole('radio', { name: 'Only tasks' })).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByRole('listitem')).toHaveCount(7);
    await expect(panel.getByRole('button', { name: 'Open Two child' })).toBeVisible();

    await panel.getByRole('radio', { name: 'Full content' }).click();
    const editor = panel.getByRole('textbox', { name: 'Description' });
    await expect(editor).toContainText('Write the plan where the work is.');
    await expect(editor.getByRole('button', { name: 'Open Two child' })).toBeVisible();
    await expect(editor).toContainText('Closing note.');
    await page.screenshot({ path: 'dist/screenshots/import-golden-path.png' });

    const undo = await api.delete<{ deleted: string[] }>(`/imports/${imported.manifestId}`, {});
    expect(undo.deleted).toHaveLength(8);
    expect(errors).toEqual([]);
  } finally {
    await api.deleteCollection(collection.id);
  }
});
