import crypto from 'node:crypto';

import { expect, test } from '../../fixtures/api';

function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

test.describe('Task move API', () => {
  test('keeps list order stable while board status order changes', async ({ api }) => {
    const collection = await api.createCollection({
      name: uniqueName('status-move'),
      color: '#adb9c1',
    });

    try {
      const [backlog, todo, doing] = await api.seedStatuses(collection.id);
      const taskA = await api.createTask({
        title: uniqueName('alpha'),
        collectionId: collection.id,
        priority: 2,
        orderValue: 1000,
      });
      const taskB = await api.createTask({
        title: uniqueName('beta'),
        collectionId: collection.id,
        priority: 2,
        orderValue: 2000,
      });

      const before = await api.fetchCollectionView(collection.id);
      const beforeIds = before.tasks.map((task) => task.id);
      const beforeTaskA = before.tasks.find((task) => task.id === taskA.id);
      expect(beforeTaskA).toBeTruthy();

      const result = await api.moveTask(taskA.id, {
        parentTaskId: null,
        collectionId: collection.id,
        statusId: doing.id,
        scope: {
          kind: 'status',
          collectionId: collection.id,
          statusId: doing.id,
        },
        position: 0,
      });

      expect(result.moved[0].statusId).toBe(doing.id);
      expect(result.reordered.map((task) => task.id)).toEqual(expect.arrayContaining([taskA.id]));

      const secondResult = await api.moveTask(taskB.id, {
        parentTaskId: null,
        collectionId: collection.id,
        statusId: doing.id,
        scope: {
          kind: 'status',
          collectionId: collection.id,
          statusId: doing.id,
        },
        position: 1,
      });

      expect(secondResult.moved[0].statusId).toBe(doing.id);

      const after = await api.fetchCollectionView(collection.id);
      expect(after.tasks.map((task) => task.id)).toEqual(beforeIds);
      expect(after.tasks.find((task) => task.id === taskA.id)?.orderValue).toBe(beforeTaskA?.orderValue);
      expect(after.boardOrder.status[taskA.id]).toBe(0);
      expect(after.boardOrder.status[taskB.id]).toBe(1000);
      expect(after.tasks.find((task) => task.id === taskA.id)?.statusId).toBe(doing.id);
      expect(after.statuses.map((status) => status.id)).toEqual(
        expect.arrayContaining([backlog.id, todo.id, doing.id]),
      );

      const priorityMove = await api.moveTask(taskB.id, {
        parentTaskId: null,
        collectionId: collection.id,
        priority: 1,
        scope: {
          kind: 'priority',
          collectionId: collection.id,
          priority: 1,
        },
        position: 0,
      });

      expect(priorityMove.moved[0].priority).toBe(1);
      const afterPriority = await api.fetchCollectionView(collection.id);
      expect(afterPriority.tasks.map((task) => task.id)).toEqual(beforeIds);
      expect(afterPriority.tasks.find((task) => task.id === taskB.id)?.orderValue).toBe(2000);
      expect(afterPriority.boardOrder.priority[taskB.id]).toBe(0);
      expect(afterPriority.tasks.find((task) => task.id === taskB.id)?.priority).toBe(1);
    } finally {
      await api.deleteCollection(collection.id);
    }
  });

  test('clears status when moving across collections without an explicit destination status', async ({ api }) => {
    const sourceCollection = await api.createCollection({
      name: uniqueName('source'),
      color: '#adb9c1',
    });
    const targetCollection = await api.createCollection({
      name: uniqueName('target'),
      color: '#adb9c1',
    });

    try {
      const [sourceBacklog, , sourceDoing] = await api.seedStatuses(sourceCollection.id);
      const [targetBacklog, targetTodo, targetDoing] = await api.seedStatuses(targetCollection.id);
      expect(sourceBacklog.id).toBeTruthy();
      expect(targetBacklog.id).toBeTruthy();

      const task = await api.createTask({
        title: uniqueName('cross'),
        collectionId: sourceCollection.id,
        priority: 3,
      });

      const moved = await api.moveTask(task.id, {
        parentTaskId: null,
        collectionId: targetCollection.id,
        scope: {
          kind: 'collection',
          collectionId: targetCollection.id,
        },
        position: 0,
      });

      expect(moved.moved[0].collectionId).toBe(targetCollection.id);
      expect(moved.moved[0].statusId).toBeNull();

      const targetView = await api.fetchCollectionView(targetCollection.id);
      expect(targetView.tasks.find((entry) => entry.id === task.id)?.statusId).toBeNull();
      expect(targetView.tasks.find((entry) => entry.id === task.id)?.collectionId).toBe(targetCollection.id);
      expect(targetView.statuses.map((status) => status.id)).toEqual(
        expect.arrayContaining([targetBacklog.id, targetTodo.id, targetDoing.id]),
      );
    } finally {
      await api.deleteCollection(targetCollection.id);
      await api.deleteCollection(sourceCollection.id);
    }
  });
});
