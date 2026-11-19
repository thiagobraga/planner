import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { redisClient, redisPubClient } from "../../db/redis.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import type { SyncEvent } from "../syncService.js";
import { createTask, deleteTask } from "../taskService.js";

let fixture: Awaited<ReturnType<typeof createTestUserWithCollection>>;
const subscriber = redisClient.duplicate();
let events: SyncEvent[] = [];

beforeAll(async () => {
  await redisPubClient.connect();
  await subscriber.connect();
  await subscriber.subscribe("sync", (message) => {
    events.push(JSON.parse(message) as SyncEvent);
  });
});

afterAll(async () => {
  await subscriber.quit();
  await redisPubClient.quit();
});

beforeEach(async () => {
  events = [];
  fixture = await createTestUserWithCollection();
});

afterEach(async () => {
  await fixture.cleanup();
});

async function activityFor(entityId: string) {
  const { rows } = await pool.query(
    "SELECT event_type, after_data, before_data, actor_type FROM activity_events WHERE entity_id = $1 ORDER BY created_at",
    [entityId],
  );
  return rows;
}

it("creates a labelled task, records its activity and publishes the created event", async () => {
  const { userId, collectionId } = fixture;
  const label = await pool.query<{ id: string }>(
    "INSERT INTO labels (user_id, name, color) VALUES ($1, 'urgent', '#c9483b') RETURNING id",
    [userId],
  );
  const labelId = label.rows[0].id;

  const task = await createTask(userId, { title: "Write spec", collectionId, labelIds: [labelId] });

  expect(task).toMatchObject({ title: "Write spec", collectionId, depth: 0, type: "task" });
  expect(task.labels.map((l) => l.id)).toEqual([labelId]);
  expect(await activityFor(task.id)).toEqual([
    { event_type: "task_created", after_data: { title: "Write spec" }, before_data: null, actor_type: "session" },
  ]);
  await expect.poll(() => events.find((e) => e.entityId === task.id)).toMatchObject({
    entityType: "task",
    eventType: "created",
    userId,
    collectionId,
    payload: { id: task.id, labels: [{ id: labelId }] },
  });
});

it("stores boundary titles, every priority and every type, defaulting to the inbox and 'task'", async () => {
  const { userId } = fixture;
  const inbox = await pool.query<{ id: string }>(
    "INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#c9483b', true) RETURNING id",
    [userId],
  );
  const cases = [
    { input: { title: "a" }, expected: { title: "a", priority: 4, type: "task" } },
    { input: { title: "x".repeat(500), priority: 1 }, expected: { title: "x".repeat(500), priority: 1 } },
    { input: { title: "two", priority: 2, type: "note" as const }, expected: { priority: 2, type: "note" } },
    { input: { title: "three", priority: 3, type: "event" as const }, expected: { priority: 3, type: "event" } },
  ];

  for (const { input, expected } of cases) {
    const task = await createTask(userId, input);
    expect(task).toMatchObject({ ...expected, collectionId: inbox.rows[0].id });
    const stored = await pool.query("SELECT title, priority, type FROM tasks WHERE id = $1", [task.id]);
    expect(stored.rows[0]).toMatchObject(expected);
    await expect.poll(() => events.find((e) => e.entityId === task.id)?.payload)
      .toMatchObject({ type: task.type });
  }
});

it("nests subtasks up to depth 5 and rejects a sixth level without writing it", async () => {
  const { userId, collectionId } = fixture;
  let parent = await createTask(userId, { title: "Level 0", collectionId });
  for (let depth = 1; depth <= 5; depth++) {
    parent = await createTask(userId, { title: `Level ${depth}`, parentTaskId: parent.id });
    expect(parent).toMatchObject({ depth, collectionId });
  }

  await expect(createTask(userId, { title: "Too deep", parentTaskId: parent.id }))
    .rejects.toMatchObject({ code: "MAX_DEPTH_EXCEEDED" });
  const { rowCount } = await pool.query("SELECT 1 FROM tasks WHERE title = 'Too deep' AND user_id = $1", [userId]);
  expect(rowCount).toBe(0);
});

it("creates nothing and publishes nothing when the collection is not accessible", async () => {
  const stranger = await createTestUserWithCollection();
  try {
    await expect(createTask(fixture.userId, { title: "Sneaky", collectionId: stranger.collectionId }))
      .rejects.toMatchObject({ statusCode: 400 });
    const { rowCount } = await pool.query("SELECT 1 FROM tasks WHERE collection_id = $1", [stranger.collectionId]);
    expect(rowCount).toBe(0);
    expect(events).toEqual([]);
  } finally {
    await stranger.cleanup();
  }
});

it("deletes the subtree, records the deletion and publishes the deleted event", async () => {
  const { userId, collectionId } = fixture;
  const parent = await createTask(userId, { title: "Parent", collectionId });
  const child = await createTask(userId, { title: "Child", parentTaskId: parent.id });

  await expect(deleteTask(parent.id, userId)).resolves.toEqual({ success: true });

  const { rowCount } = await pool.query("SELECT 1 FROM tasks WHERE id = ANY($1)", [[parent.id, child.id]]);
  expect(rowCount).toBe(0);
  expect((await activityFor(parent.id)).map((row) => row.event_type)).toEqual(["task_created", "task_deleted"]);
  await expect.poll(() => events.find((e) => e.entityId === parent.id && e.eventType === "deleted"))
    .toMatchObject({ entityType: "task", userId, collectionId });
});
