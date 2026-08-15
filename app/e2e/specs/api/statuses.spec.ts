import crypto from 'node:crypto';

import { expect, test } from '../../fixtures/api';

function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

test.describe('Statuses API', () => {
  test('seeds statuses idempotently and supports CRUD', async ({ api }) => {
    const collection = await api.createCollection({
      name: uniqueName('statuses'),
      color: '#adb9c1',
    });

    try {
      const seededOnce = await api.seedStatuses(collection.id);
      const seededTwice = await api.seedStatuses(collection.id);

      expect(seededOnce).toHaveLength(4);
      expect(seededTwice).toHaveLength(4);
      expect(seededTwice.map((status) => status.id)).toEqual(seededOnce.map((status) => status.id));
      expect(seededTwice.map((status) => status.name)).toEqual(['Backlog', 'Todo', 'Doing', 'Completed']);

      const created = await api.createStatus(collection.id, {
        name: uniqueName('blocked'),
        color: '#c9483b',
      });

      const updated = await api.updateStatus(created.id, {
        name: uniqueName('ready'),
        color: '#b08b8a',
        position: 1,
      });
      expect(updated.name).toMatch(/^ready-/);
      expect(updated.color).toBe('#b08b8a');

      const afterUpdate = await api.fetchStatuses(collection.id);
      expect(afterUpdate).toHaveLength(5);
      expect(afterUpdate[1].id).toBe(created.id);
      expect(afterUpdate[1].name).toBe(updated.name);
      expect(afterUpdate[1].color).toBe('#b08b8a');

      await api.deleteStatus(created.id, seededOnce[0].id);

      const afterDelete = await api.fetchStatuses(collection.id);
      expect(afterDelete).toHaveLength(4);
      expect(afterDelete.map((status) => status.id)).not.toContain(created.id);
    } finally {
      await api.deleteCollection(collection.id);
    }
  });

  test('rejects deleting the final status with 409', async ({ api }) => {
    const collection = await api.createCollection({
      name: uniqueName('single-status'),
      color: '#adb9c1',
    });

    try {
      const created = await api.createStatus(collection.id, {
        name: uniqueName('only'),
        color: '#adb9c1',
      });

      await expect(api.deleteStatus(created.id)).rejects.toThrow(/409/);
    } finally {
      await api.deleteCollection(collection.id);
    }
  });
});
