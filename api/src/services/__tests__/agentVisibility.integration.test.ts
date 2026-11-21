import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { withActor } from "../../middleware/requestContext.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import type { RequestActor } from "../../types/activity.js";
import { createPersonalToken } from "../apiTokenService.js";
import { createComment, listComments } from "../commentService.js";
import { createTask } from "../taskService.js";
import { claimTask, releaseTaskClaim } from "../task/claim.js";
import { getTaskDetail } from "../task/detail.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;

let owner: Fixture;
let agent: RequestActor;
let taskId: string;

beforeAll(async () => {
  await connectRedis();
});

afterAll(async () => {
  await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
});

beforeEach(async () => {
  owner = await createTestUserWithCollection();
  const token = await createPersonalToken(owner.userId, { name: "Agent Alpha", scopes: ["read", "write"], expiresInDays: 30 });
  agent = { type: "token", credentialId: token.token.id, label: token.token.name };
  taskId = (await createTask(owner.userId, { title: "Parent", collectionId: owner.collectionId })).id;
});

afterEach(async () => {
  await redisClient.del(`task:claim:${taskId}`);
  await owner.cleanup();
});

describe("agent visibility in the detail panel (real PostgreSQL + Redis)", () => {
  it("stamps comments with the acting token label and leaves browser comments unlabeled", async () => {
    await withActor(agent, () => createComment(taskId, owner.userId, "PR opened: https://github.com/o/r/pull/1"));
    await createComment(taskId, owner.userId, "Looks good");

    const comments = await listComments(taskId, owner.userId);
    expect(comments.map((c) => c.actorLabel)).toEqual(["Agent Alpha", null]);
  });

  it("returns the active claim with the task detail and drops it after release", async () => {
    expect((await getTaskDetail(taskId, owner.userId)).claim).toBeNull();

    await withActor(agent, () => claimTask(taskId, owner.userId, { ttlSeconds: 600 }));
    const claimed = await getTaskDetail(taskId, owner.userId);
    expect(claimed.claim).toMatchObject({ label: "Agent Alpha", actorType: "token" });
    expect(claimed.claim).not.toHaveProperty("credentialId");
    expect(Date.parse(claimed.claim!.expiresAt)).toBeGreaterThan(Date.now());

    await withActor(agent, () => releaseTaskClaim(taskId, owner.userId));
    expect((await getTaskDetail(taskId, owner.userId)).claim).toBeNull();
  });
});
