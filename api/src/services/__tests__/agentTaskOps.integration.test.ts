import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { withActor } from "../../middleware/requestContext.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import type { RequestActor } from "../../types/activity.js";
import { createPersonalToken } from "../apiTokenService.js";
import { createTask } from "../taskService.js";
import { claimTask, getTaskClaim, releaseTaskClaim } from "../task/claim.js";
import { batchCreateTasks } from "../task/batch.js";
import { editTaskDocumentBlocks } from "../document/editBlocks.js";
import { getTaskDocument } from "../documentService.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;

let owner: Fixture;
let collaborator: Fixture;
let stranger: Fixture;
let parentTaskId: string;
let agentA: RequestActor;
let agentB: RequestActor;

beforeAll(async () => {
  await connectRedis();
});

afterAll(async () => {
  await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
});

beforeEach(async () => {
  owner = await createTestUserWithCollection();
  collaborator = await createTestUserWithCollection();
  stranger = await createTestUserWithCollection();
  await pool.query("INSERT INTO collaborators (collection_id, user_id) VALUES ($1, $2)", [
    owner.collectionId,
    collaborator.userId,
  ]);
  const tokenA = await createPersonalToken(owner.userId, {
    name: "Agent Alpha",
    scopes: ["read", "write"],
    expiresInDays: 30,
  });
  const tokenB = await createPersonalToken(collaborator.userId, {
    name: "Agent Beta",
    scopes: ["read", "write"],
    expiresInDays: 30,
  });
  agentA = { type: "token", credentialId: tokenA.token.id, label: tokenA.token.name };
  agentB = { type: "token", credentialId: tokenB.token.id, label: tokenB.token.name };
  const parent = await createTask(owner.userId, {
    title: "Parent initiative",
    collectionId: owner.collectionId,
  });
  parentTaskId = parent.id;
});

afterEach(async () => {
  await owner.cleanup();
  await collaborator.cleanup();
  await stranger.cleanup();
});

describe("atomic task claims (real PostgreSQL + Redis)", () => {
  it("yields one winner when two agents claim concurrently and derives identity from actor context", async () => {
    const now = new Date("2026-11-19T12:00:00Z");
    const results = await Promise.allSettled([
      withActor(agentA, () => claimTask(parentTaskId, owner.userId, { ttlSeconds: 600, now })),
      withActor(agentB, () => claimTask(parentTaskId, collaborator.userId, { ttlSeconds: 600, now })),
    ]);

    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof claimTask>>> => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "TASK_CLAIMED", statusCode: 409 });

    const winner = fulfilled[0].value;
    expect(["Agent Alpha", "Agent Beta"]).toContain(winner.label);
    const active = await getTaskClaim(parentTaskId, owner.userId, now);
    expect(active).toMatchObject({
      taskId: parentTaskId,
      credentialId: winner.credentialId,
      label: winner.label,
    });
  });

  it("recovers automatically after expiry or explicitly with force, and records claim/release activity", async () => {
    const t0 = new Date("2026-11-19T12:00:00Z");
    const claimed = await withActor(agentA, () =>
      claimTask(parentTaskId, owner.userId, { ttlSeconds: 300, now: t0 }),
    );
    expect(claimed.label).toBe("Agent Alpha");

    // Same holder can renew idempotently
    const renewed = await withActor(agentA, () =>
      claimTask(parentTaskId, owner.userId, { ttlSeconds: 300, now: new Date("2026-11-19T12:01:00Z") }),
    );
    expect(renewed.credentialId).toBe(agentA.credentialId);

    // Other agent cannot release without force before expiry
    await expect(
      withActor(agentB, () =>
        releaseTaskClaim(parentTaskId, collaborator.userId, { now: new Date("2026-11-19T12:02:00Z") }),
      ),
    ).rejects.toMatchObject({ code: "TASK_CLAIMED", statusCode: 409 });

    // After expiry (12:01 + 5m = 12:06), Agent Beta can claim without force
    const afterExpiry = new Date("2026-11-19T12:07:00Z");
    const takenOver = await withActor(agentB, () =>
      claimTask(parentTaskId, collaborator.userId, { ttlSeconds: 300, now: afterExpiry }),
    );
    expect(takenOver.label).toBe("Agent Beta");

    // Explicit force recovery before expiry
    const forceRecovered = await withActor(agentA, () =>
      claimTask(parentTaskId, owner.userId, { ttlSeconds: 300, force: true, now: afterExpiry }),
    );
    expect(forceRecovered.label).toBe("Agent Alpha");

    const released = await withActor(agentA, () =>
      releaseTaskClaim(parentTaskId, owner.userId, { now: afterExpiry }),
    );
    expect(released).toEqual({ released: true });
    expect(await getTaskClaim(parentTaskId, owner.userId, afterExpiry)).toBeNull();

    // Stranger cannot claim or inspect claims
    await expect(
      withActor(agentB, () => claimTask(parentTaskId, stranger.userId, { now: afterExpiry })),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });

    const activity = await pool.query<{ event_type: string; actor_label: string }>(
      `SELECT event_type, actor_label FROM activity_events
       WHERE entity_id = $1 AND event_type IN ('task_claimed', 'task_released')
       ORDER BY created_at ASC`,
      [parentTaskId],
    );
    expect(activity.rows.map((r) => r.event_type)).toContain("task_claimed");
    expect(activity.rows.map((r) => r.event_type)).toContain("task_released");
  });
});

describe("idempotent batch task creation (real PostgreSQL + Redis)", () => {
  it("creates a batch once despite retries and rejects a changed payload under the same key", async () => {
    const key = `batch-${crypto.randomUUID()}`;
    const first = await batchCreateTasks(owner.userId, {
      idempotencyKey: key,
      parentTaskId,
      tasks: [
        { title: "Step 1" },
        { title: "Step 2", priority: 2 },
      ],
    });
    expect(first.deduplicated).toBe(false);
    expect(first.tasks.map((t) => t.title)).toEqual(["Step 1", "Step 2"]);
    expect(first.tasks.every((t) => t.parentTaskId === parentTaskId && t.depth === 1)).toBe(true);

    const retry = await batchCreateTasks(owner.userId, {
      idempotencyKey: key,
      parentTaskId,
      tasks: [
        { title: "Step 1" },
        { title: "Step 2", priority: 2 },
      ],
    });
    expect(retry.deduplicated).toBe(true);
    expect(retry.tasks.map((t) => t.id)).toEqual(first.tasks.map((t) => t.id));

    await expect(
      batchCreateTasks(owner.userId, {
        idempotencyKey: key,
        parentTaskId,
        tasks: [{ title: "Step 1 changed" }],
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", statusCode: 409 });

    const count = await pool.query("SELECT COUNT(*)::int AS c FROM tasks WHERE parent_task_id = $1", [parentTaskId]);
    expect(count.rows[0].c).toBe(2);
  });

  it("rolls back the entire batch when any item fails validation or depth limits", async () => {
    const key = `rollback-${crypto.randomUUID()}`;
    await expect(
      batchCreateTasks(owner.userId, {
        idempotencyKey: key,
        parentTaskId,
        tasks: [
          { title: "Valid first task" },
          { title: "Invalid priority task", priority: 99 },
        ],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

    const count = await pool.query("SELECT COUNT(*)::int AS c FROM tasks WHERE parent_task_id = $1", [parentTaskId]);
    expect(count.rows[0].c).toBe(0);
  });
});

describe("document block edits and atomic create-and-embed (real PostgreSQL + Redis)", () => {
  it("atomically creates and embeds a child task, deduplicates retries by blockId, and unlinks without deleting", async () => {
    const embedded = await editTaskDocumentBlocks(parentTaskId, owner.userId, {
      baseRevision: 0,
      operation: {
        kind: "embed_subtask",
        title: "Embedded child",
        blockId: "blk-child-1",
      },
    });
    expect(embedded.createdTaskId).toBeDefined();
    expect(embedded.document.revision).toBe(1);

    // Retry with same blockId is idempotent even against revision 0
    const retried = await editTaskDocumentBlocks(parentTaskId, owner.userId, {
      baseRevision: 0,
      operation: {
        kind: "embed_subtask",
        title: "Embedded child",
        blockId: "blk-child-1",
      },
    });
    expect(retried.createdTaskId).toBe(embedded.createdTaskId);
    expect(retried.document.revision).toBe(1);

    // Stale revision on a new operation conflicts and does not create an orphan task
    await expect(
      editTaskDocumentBlocks(parentTaskId, owner.userId, {
        baseRevision: 0,
        operation: {
          kind: "embed_subtask",
          title: "Should rollback",
          blockId: "blk-child-2",
        },
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_CONFLICT", statusCode: 409 });

    const childrenAfterConflict = await pool.query("SELECT id, title FROM tasks WHERE parent_task_id = $1", [parentTaskId]);
    expect(childrenAfterConflict.rows).toEqual([{ id: embedded.createdTaskId, title: "Embedded child" }]);

    // Unlink block by blockId: removes from document, preserves the child task row
    const afterUnlink = await editTaskDocumentBlocks(parentTaskId, owner.userId, {
      baseRevision: 1,
      operation: {
        kind: "remove_block",
        blockId: "blk-child-1",
      },
    });
    expect(afterUnlink.document.revision).toBe(2);
    const currentDoc = await getTaskDocument(parentTaskId, owner.userId);
    expect(JSON.stringify(currentDoc.content)).not.toContain("blk-child-1");

    const stillExists = await pool.query("SELECT id FROM tasks WHERE id = $1", [embedded.createdTaskId]);
    expect(stillExists.rows).toHaveLength(1);
  });

  it("creates a standalone task in the same collection when embedding inside a note", async () => {
    const note = await createTask(owner.userId, {
      title: "Architecture note",
      collectionId: owner.collectionId,
      type: "note",
    });
    const res = await editTaskDocumentBlocks(note.id, owner.userId, {
      baseRevision: 0,
      operation: {
        kind: "embed_subtask",
        title: "Follow-up task from note",
        blockId: "note-ref-1",
      },
    });
    const createdRow = await pool.query<{ parent_task_id: string | null; collection_id: string; type: string }>(
      "SELECT parent_task_id, collection_id, type FROM tasks WHERE id = $1",
      [res.createdTaskId],
    );
    expect(createdRow.rows[0]).toEqual({
      parent_task_id: null,
      collection_id: owner.collectionId,
      type: "task",
    });
  });
});
