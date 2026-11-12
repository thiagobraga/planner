import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createTask, moveTask } from "../taskService.js";
import { createStatus, deleteStatus, listStatuses, setCollectionCompletionStatus, updateStatus } from "../statusService.js";

describe("status transition rules (real PostgreSQL)", () => {
  let userId: string;
  let collectionId: string;
  let otherCollectionId: string;

  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = randomUUID();
    collectionId = randomUUID();
    otherCollectionId = randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `status-rules-${userId}@example.com`]);
    await pool.query("INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Flow', '#c9483b'), ($3, $2, 'Other', '#c9483b')", [collectionId, userId, otherCollectionId]);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("persists transition branches and rejects a destination in another collection", async () => {
    const source = await createStatus(collectionId, userId, { name: "Backlog" });
    const accepted = await createStatus(collectionId, userId, { name: "Accepted" });
    const rejected = await createStatus(collectionId, userId, { name: "Rejected" });
    const foreign = await createStatus(otherCollectionId, userId, { name: "Foreign" });

    const configured = await updateStatus(source.id, userId, {
      nextStatusMode: "custom", nextStatusId: accepted.id,
      acceptStatusId: accepted.id, rejectStatusId: rejected.id,
    });
    expect(configured).toMatchObject({
      nextStatusMode: "custom", nextStatusId: accepted.id,
      acceptStatusId: accepted.id, rejectStatusId: rejected.id,
    });
    expect((await listStatuses(collectionId, userId)).find((status) => status.id === source.id)).toMatchObject({
      nextStatusMode: "custom", nextStatusId: accepted.id,
    });
    await expect(updateStatus(source.id, userId, { rejectStatusId: foreign.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR", statusCode: 400,
      details: [{ field: "rejectStatusId", message: expect.any(String) }],
    });
  });

  it("clears routes to deleted statuses while preserving other branches", async () => {
    const source = await createStatus(collectionId, userId, { name: "Backlog" });
    const destination = await createStatus(collectionId, userId, { name: "Doing" });
    const fallback = await createStatus(collectionId, userId, { name: "Done" });
    await setCollectionCompletionStatus(collectionId, userId, fallback.id);
    await updateStatus(source.id, userId, {
      nextStatusMode: "custom", nextStatusId: destination.id,
      acceptStatusId: destination.id, rejectStatusId: fallback.id,
    });

    await deleteStatus(destination.id, userId);

    const refreshed = (await listStatuses(collectionId, userId)).find((status) => status.id === source.id);
    expect(refreshed).toMatchObject({
      nextStatusMode: "disabled", nextStatusId: null,
      acceptStatusId: null, rejectStatusId: fallback.id,
    });
  });

  it("completes a task when it moves to the configured completion destination", async () => {
    const source = await createStatus(collectionId, userId, { name: "Todo" });
    const done = await createStatus(collectionId, userId, { name: "Done" });
    await setCollectionCompletionStatus(collectionId, userId, done.id);
    await updateStatus(source.id, userId, { acceptStatusId: done.id });
    const task = await createTask(userId, { title: "Review", collectionId });
    await moveTask(task.id, userId, {
      parentTaskId: null, statusId: source.id,
      scope: { kind: "status", collectionId, statusId: source.id }, position: 0,
    });

    await moveTask(task.id, userId, {
      parentTaskId: null, statusId: done.id,
      scope: { kind: "status", collectionId, statusId: done.id }, position: 0,
    });
    const result = await pool.query("SELECT is_completed FROM tasks WHERE id = $1", [task.id]);
    expect(result.rows[0].is_completed).toBe(true);
  });
});
