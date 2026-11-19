import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import pool from "../../db/pool.js";
import { redisClient, redisPubClient } from "../../db/redis.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import { requestContext } from "../../middleware/requestContext.js";
import type { SyncEvent } from "../syncService.js";
import { runMutation } from "../mutationRunner.js";

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
  vi.restoreAllMocks();
  await fixture.cleanup();
});

/** Inserts a task, records its activity and emits its event, all through the runner. */
function createThroughRunner(taskId: string, after?: () => void) {
  const { userId, collectionId } = fixture;
  return runMutation(async (tx) => {
    await tx.client.query(
      "INSERT INTO tasks (id, user_id, collection_id, title, order_value) VALUES ($1, $2, $3, 'Runner task', 0)",
      [taskId, userId, collectionId],
    );
    await tx.recordActivity({
      userId,
      collectionId,
      entityType: "task",
      entityId: taskId,
      eventType: "task_created",
    });
    tx.emit({ entityType: "task", eventType: "created", entityId: taskId, userId, collectionId });
    after?.();
    return taskId;
  });
}

async function storedState(taskId: string) {
  const task = await pool.query("SELECT id FROM tasks WHERE id = $1", [taskId]);
  const activity = await pool.query("SELECT event_type FROM activity_events WHERE entity_id = $1", [taskId]);
  return { task: task.rowCount, activity: activity.rows.map((row) => row.event_type) };
}

it("publishes events only after the write and its activity are committed", async () => {
  const taskId = randomUUID();
  const publish = redisPubClient.publish.bind(redisPubClient);
  const seenAtPublish: Awaited<ReturnType<typeof storedState>>[] = [];
  vi.spyOn(redisPubClient, "publish").mockImplementation(async (channel, message) => {
    seenAtPublish.push(await storedState(taskId));
    return publish(channel, message);
  });

  const result = await createThroughRunner(taskId);

  expect(result).toBe(taskId);
  await expect.poll(() => seenAtPublish).toEqual([{ task: 1, activity: ["task_created"] }]);
  await expect.poll(() => events.filter((event) => event.entityId === taskId).map((event) => event.eventType))
    .toEqual(["created"]);
});

it("rolls back the write and activity and publishes nothing when the callback fails", async () => {
  const taskId = randomUUID();
  const publish = vi.spyOn(redisPubClient, "publish");
  const failure = new Error("domain rule broken");

  await expect(createThroughRunner(taskId, () => { throw failure; })).rejects.toBe(failure);

  expect(await storedState(taskId)).toEqual({ task: 0, activity: [] });
  expect(publish).not.toHaveBeenCalled();
});

it("keeps the committed write when publishing fails afterwards", async () => {
  const taskId = randomUUID();
  vi.spyOn(redisPubClient, "publish").mockRejectedValueOnce(new Error("redis outage"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(createThroughRunner(taskId)).resolves.toBe(taskId);

  expect(await storedState(taskId)).toEqual({ task: 1, activity: ["task_created"] });
  await expect.poll(() => log.mock.calls.some(([message]) => String(message).startsWith("[mutation]"))).toBe(true);
});

it("does not hold the response while Redis is stalled", async () => {
  const taskId = randomUUID();
  vi.spyOn(redisPubClient, "publish").mockReturnValue(new Promise<number>(() => {}));

  await expect(createThroughRunner(taskId)).resolves.toBe(taskId);
  expect(await storedState(taskId)).toEqual({ task: 1, activity: ["task_created"] });
});

it("stamps events with the calling socket from the request context", async () => {
  const taskId = randomUUID();
  const req = { headers: { "x-socket-id": "socket-a" } } as unknown as Request;
  let run: Promise<string> | undefined;

  requestContext(req, {} as Response, () => { run = createThroughRunner(taskId); });
  await run;

  await expect.poll(() => events.find((event) => event.entityId === taskId)?.sourceId).toBe("socket-a");
});
