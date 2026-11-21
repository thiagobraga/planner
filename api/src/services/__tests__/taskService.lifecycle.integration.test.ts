import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { redisPubClient, redisSubClient } from "../../db/redis.js";
import type { SyncEvent } from "../syncService.js";
import {
  createTask,
  updateTask,
  completeTask,
  reopenTask,
  deleteTask,
  moveTask,
  reorderTask,
  reorganizeTasks,
} from "../taskService.js";

describe("taskService lifecycle, rollback, and Redis sync (real PostgreSQL + Redis)", () => {
  let userId: string;
  let collectionId: string;
  let otherCollectionId: string;
  let receivedEvents: SyncEvent[] = [];

  beforeAll(async () => {
    if (!redisPubClient.isOpen) await redisPubClient.connect();
    if (!redisSubClient.isOpen) await redisSubClient.connect();
    await redisSubClient.subscribe("sync", (msg) => {
      try {
        receivedEvents.push(JSON.parse(msg) as SyncEvent);
      } catch {
        // ignore malformed messages from other suites
      }
    });
  });

  afterAll(async () => {
    if (redisSubClient.isOpen) {
      await redisSubClient.unsubscribe("sync");
      await redisSubClient.quit();
    }
    if (redisPubClient.isOpen) {
      await redisPubClient.quit();
    }
  });

  beforeEach(async () => {
    receivedEvents = [];
    userId = crypto.randomUUID();
    collectionId = crypto.randomUUID();
    otherCollectionId = crypto.randomUUID();
    await pool.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')`, [
      userId,
      `lifecycle-${userId}@example.com`,
    ]);
    await pool.query(
      `INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Primary', '#c9483b'), ($3, $2, 'Secondary', '#7dbfb2')`,
      [collectionId, userId, otherCollectionId],
    );
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  async function waitForSyncEvent(predicate: (event: SyncEvent) => boolean): Promise<SyncEvent> {
    for (let i = 0; i < 40; i++) {
      const found = receivedEvents.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 15));
    }
    throw new Error("Timed out waiting for Redis sync event");
  }

  it("delivers created, updated, completed, uncompleted, and deleted events over Redis and records activity", async () => {
    const task = await createTask(userId, { title: "Lifecycle task", collectionId, dueDate: "2026-11-20" });
    const createdEvt = await waitForSyncEvent((e) => e.entityId === task.id && e.eventType === "created");
    expect(createdEvt.collectionId).toBe(collectionId);

    const updated = await updateTask(task.id, userId, { title: "Updated title", priority: 2 });
    expect(updated.title).toBe("Updated title");
    expect(updated.priority).toBe(2);
    await waitForSyncEvent((e) => e.entityId === task.id && e.eventType === "updated");

    const child = await createTask(userId, { title: "Subtask", parentTaskId: task.id });
    expect(child.depth).toBe(1);

    await completeTask(task.id, userId);
    await waitForSyncEvent((e) => e.entityId === task.id && e.eventType === "completed");

    const childRow = await pool.query(`SELECT is_completed FROM tasks WHERE id = $1`, [child.id]);
    expect(childRow.rows[0].is_completed).toBe(true);

    await reopenTask(task.id, userId);
    await waitForSyncEvent((e) => e.entityId === task.id && e.eventType === "uncompleted");

    await deleteTask(task.id, userId);
    await waitForSyncEvent((e) => e.entityId === task.id && e.eventType === "deleted");

    const activities = await pool.query(
      `SELECT event_type FROM activity_events WHERE user_id = $1 AND entity_id = $2 ORDER BY created_at ASC, id ASC`,
      [userId, task.id],
    );
    expect(activities.rows.map((r) => r.event_type)).toEqual([
      "task_created",
      "task_updated",
      "task_completed",
      "task_reopened",
      "task_deleted",
    ]);
  });

  it("clones recurring tasks on completion and clears recurrence on the completed history row", async () => {
    const recurring = await createTask(userId, {
      title: "Daily standup",
      collectionId,
      dueDate: "2026-11-20",
      recurrenceRule: { type: "daily", interval: 1 },
    });

    const completedOld = await completeTask(recurring.id, userId, new Date("2026-11-20T12:00:00Z"));
    expect(completedOld.isCompleted).toBe(true);
    expect(completedOld.recurrenceRule).toBeNull();

    const cloneEvt = await waitForSyncEvent(
      (e) => e.userId === userId && e.eventType === "created" && e.entityId !== recurring.id,
    );
    const allTasks = await pool.query(
      `SELECT id, due_date::text AS due_date, is_completed, recurrence_rule FROM tasks WHERE collection_id = $1 ORDER BY is_completed ASC`,
      [collectionId],
    );
    expect(allTasks.rows).toHaveLength(2);
    expect(allTasks.rows[0].id).toBe(cloneEvt.entityId);
    expect(allTasks.rows[0].due_date).toBe("2026-11-21");
    expect(allTasks.rows[0].is_completed).toBe(false);
    expect(allTasks.rows[0].recurrence_rule).toEqual({ type: "daily", interval: 1 });
  });

  it("rolls back moveTask when target status does not belong to destination collection", async () => {
    const parent = await createTask(userId, { title: "Root", collectionId, dueDate: "2026-11-20" });
    const foreignStatusId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO task_statuses (id, collection_id, name, color, order_value) VALUES ($1, $2, 'Foreign', '#c9483b', 0)`,
      [foreignStatusId, otherCollectionId],
    );

    await expect(
      moveTask(parent.id, userId, {
        parentTaskId: null,
        collectionId,
        statusId: foreignStatusId,
        scope: { kind: "status", collectionId, statusId: foreignStatusId },
        position: 0,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const check = await pool.query(`SELECT collection_id, status_id FROM tasks WHERE id = $1`, [parent.id]);
    expect(check.rows[0].collection_id).toBe(collectionId);
    expect(check.rows[0].status_id).toBeNull();
  });

  it("rejects cyclic parent assignment in updateTask and rolls back reorganizeTasks when a subtask is included", async () => {
    const a = await createTask(userId, { title: "Task A", collectionId, dueDate: "2026-11-18" });
    const b = await createTask(userId, {
      title: "Task B",
      collectionId,
      parentTaskId: a.id,
      dueDate: "2026-11-18",
    });

    await expect(updateTask(a.id, userId, { parentTaskId: b.id })).rejects.toMatchObject({
      code: "CYCLIC_REFERENCE",
    });

    await expect(
      reorganizeTasks(userId, [
        { taskId: a.id, dueDate: "2026-11-25" },
        { taskId: b.id, dueDate: "2026-11-25" },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const after = await pool.query(`SELECT due_date::text AS due_date FROM tasks WHERE id = $1`, [a.id]);
    expect(after.rows[0].due_date).toBe("2026-11-18");

    const c = await createTask(userId, { title: "Task C", collectionId, dueDate: "2026-11-19" });
    const reordered = await reorderTask(c.id, userId, 0);
    expect(reordered.orderValue).toBe(0);

    const reorganized = await reorganizeTasks(userId, [{ taskId: a.id, dueDate: "2026-11-25" }]);
    expect(reorganized.updated).toBe(1);
  });
});
