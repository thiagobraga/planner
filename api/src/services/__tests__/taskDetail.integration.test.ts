import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import { createStatus } from "../statusService.js";
import { createTask } from "../taskService.js";
import { getTaskDetail } from "../task/detail.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;

let owner: Fixture;

beforeAll(async () => {
  await connectRedis();
});

afterAll(async () => {
  await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
});

beforeEach(async () => {
  owner = await createTestUserWithCollection();
});

afterEach(async () => {
  await owner.cleanup();
});

describe("getTaskDetail (real PostgreSQL)", () => {
  it("returns collection metadata and status metadata without extra client lookups", async () => {
    const status = await createStatus(owner.collectionId, owner.userId, { name: "In progress", color: "#7ea2d6" });
    const task = await createTask(owner.userId, { title: "Ship fix", collectionId: owner.collectionId });
    await pool.query("UPDATE tasks SET status_id = $1 WHERE id = $2", [status.id, task.id]);

    const detail = await getTaskDetail(task.id, owner.userId);
    expect(detail.collection).toEqual({ id: owner.collectionId, name: "Fixture collection" });
    expect(detail.status).toEqual({ id: status.id, name: "In progress", color: "#7ea2d6" });
  });

  it("returns null status when the task has no status", async () => {
    const task = await createTask(owner.userId, { title: "Unfiled task", collectionId: owner.collectionId });

    const detail = await getTaskDetail(task.id, owner.userId);
    expect(detail.collection).toEqual({ id: owner.collectionId, name: "Fixture collection" });
    expect(detail.status).toBeNull();
  });
});
