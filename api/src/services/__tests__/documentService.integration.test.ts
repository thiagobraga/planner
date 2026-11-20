import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { redisClient, redisPubClient } from "../../db/redis.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import type { SyncEvent } from "../syncService.js";
import type { AppError } from "../../utils/AppError.js";
import { getTaskDocument, putTaskDocument } from "../documentService.js";
import { updateTask } from "../task/update.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;

let owner: Fixture;
let collaborator: Fixture;
let stranger: Fixture;
let taskId: string;
const subscriber = redisClient.duplicate();
let events: SyncEvent[] = [];

const doc = (...lines: string[]) => ({
  type: "doc",
  content: lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
});

async function insertTask(fixture: Fixture, title: string, description: string | null = null): Promise<string> {
  const result = await pool.query<{ id: string }>(
    "INSERT INTO tasks (user_id, collection_id, title, description, order_value) VALUES ($1, $2, $3, $4, 0) RETURNING id",
    [fixture.userId, fixture.collectionId, title, description],
  );
  return result.rows[0].id;
}

async function stored(id = taskId) {
  const task = await pool.query("SELECT description FROM tasks WHERE id = $1", [id]);
  const document = await pool.query("SELECT revision, updated_by FROM task_documents WHERE task_id = $1", [id]);
  const activity = await pool.query(
    "SELECT user_id, event_type, after_data FROM activity_events WHERE entity_id = $1 ORDER BY created_at",
    [id],
  );
  return { description: task.rows[0]?.description, document: document.rows[0], activity: activity.rows };
}

async function conflictOf(promise: Promise<unknown>) {
  const err = (await promise.then(() => null, (e: unknown) => e)) as AppError | null;
  expect(err).toMatchObject({ code: "DOCUMENT_CONFLICT", statusCode: 409 });
  return (err!.details as { current: { revision: number; content: unknown } }[])[0].current;
}

beforeAll(async () => {
  await redisPubClient.connect();
  await subscriber.connect();
  await subscriber.subscribe("sync", (message) => {
    const event = JSON.parse(message) as SyncEvent;
    if (event.entityType === "task" && event.entityId === taskId) events.push(event);
  });
});

afterAll(async () => {
  await subscriber.quit();
  await redisPubClient.quit();
});

beforeEach(async () => {
  events = [];
  owner = await createTestUserWithCollection();
  collaborator = await createTestUserWithCollection();
  stranger = await createTestUserWithCollection();
  await pool.query("INSERT INTO collaborators (collection_id, user_id) VALUES ($1, $2)", [owner.collectionId, collaborator.userId]);
  taskId = await insertTask(owner, "Plan", "First line\nsecond\n\nNext");
});

afterEach(async () => {
  await owner.cleanup();
  await collaborator.cleanup();
  await stranger.cleanup();
});

describe("reading a document", () => {
  it("seeds revision 0 from the plain description when none is stored", async () => {
    const document = await getTaskDocument(taskId, owner.userId);
    expect(document).toEqual({
      taskId,
      schemaVersion: 1,
      revision: 0,
      updatedAt: null,
      updatedBy: null,
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "First line" }, { type: "hardBreak" }, { type: "text", text: "second" }] },
          { type: "paragraph", content: [{ type: "text", text: "Next" }] },
        ],
      },
    });
    expect((await stored()).document).toBeUndefined();
  });

  it("lets collaborators read and hides the task from everyone else", async () => {
    await expect(getTaskDocument(taskId, collaborator.userId)).resolves.toMatchObject({ revision: 0 });
    await expect(getTaskDocument(taskId, stranger.userId)).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });
});

describe("saving a document", () => {
  it("stores the first save as revision 1 and derives the description", async () => {
    const saved = await putTaskDocument(taskId, collaborator.userId, { content: doc("Rich", "text"), baseRevision: 0 });

    expect(saved).toMatchObject({ taskId, revision: 1, schemaVersion: 1, updatedBy: collaborator.userId, content: doc("Rich", "text") });
    expect(typeof saved.updatedAt).toBe("string");
    await expect(getTaskDocument(taskId, owner.userId)).resolves.toEqual(saved);
    const state = await stored();
    expect(state.description).toBe("Rich\n\ntext");
    expect(state.document).toEqual({ revision: "1", updated_by: collaborator.userId });
  });

  it("bumps the revision on every save from the current one", async () => {
    await putTaskDocument(taskId, owner.userId, { content: doc("one"), baseRevision: 0 });
    await putTaskDocument(taskId, owner.userId, { content: doc("two"), baseRevision: 1 });
    const third = await putTaskDocument(taskId, owner.userId, { content: doc("three"), baseRevision: 2 });
    expect(third.revision).toBe(3);
    expect((await stored()).description).toBe("three");
  });

  it("records activity and publishes one task update after commit", async () => {
    await putTaskDocument(taskId, owner.userId, { content: doc("Shared"), baseRevision: 0 });

    expect((await stored()).activity).toEqual([
      { user_id: owner.userId, event_type: "task_updated", after_data: { title: "Plan", fields: ["document"], revision: 1 } },
    ]);
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toMatchObject({
      entityType: "task",
      eventType: "updated",
      entityId: taskId,
      userId: owner.userId,
      collectionId: owner.collectionId,
      payload: { id: taskId, description: "Shared" },
    });
  });

  it("stores an empty description as null", async () => {
    await putTaskDocument(taskId, owner.userId, { content: { type: "doc", content: [{ type: "paragraph" }] }, baseRevision: 0 });
    expect((await stored()).description).toBeNull();
  });
});

describe("revision conflicts", () => {
  it("refuses a stale base revision and hands back the current document", async () => {
    await putTaskDocument(taskId, owner.userId, { content: doc("one"), baseRevision: 0 });
    await putTaskDocument(taskId, collaborator.userId, { content: doc("theirs"), baseRevision: 1 });
    await expect.poll(() => events.length).toBe(2);

    const current = await conflictOf(putTaskDocument(taskId, owner.userId, { content: doc("mine"), baseRevision: 1 }));
    expect(current).toMatchObject({ revision: 2, content: doc("theirs"), updatedBy: collaborator.userId });

    const state = await stored();
    expect(state.description).toBe("theirs");
    expect(state.activity).toHaveLength(2);
    // A later save proves the refused one had its chance to publish.
    await putTaskDocument(taskId, owner.userId, { content: doc("merged"), baseRevision: 2 });
    await expect.poll(() => events.map((e) => (e.payload as { description: string }).description)).toEqual(["one", "theirs", "merged"]);
  });

  it("refuses a first save when a document already exists", async () => {
    await putTaskDocument(taskId, owner.userId, { content: doc("one"), baseRevision: 0 });
    const current = await conflictOf(putTaskDocument(taskId, collaborator.userId, { content: doc("two"), baseRevision: 0 }));
    expect(current).toMatchObject({ revision: 1, content: doc("one") });
  });

  it("refuses a later revision when nothing is stored, returning the seed", async () => {
    const current = await conflictOf(putTaskDocument(taskId, owner.userId, { content: doc("x"), baseRevision: 4 }));
    expect(current).toMatchObject({ revision: 0, updatedAt: null });
    expect((await stored()).document).toBeUndefined();
  });

  it("lets exactly one of two concurrent saves from the same base win", async () => {
    await putTaskDocument(taskId, owner.userId, { content: doc("base"), baseRevision: 0 });
    const results = await Promise.allSettled([
      putTaskDocument(taskId, owner.userId, { content: doc("left"), baseRevision: 1 }),
      putTaskDocument(taskId, collaborator.userId, { content: doc("right"), baseRevision: 1 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "DOCUMENT_CONFLICT" } });
    const state = await stored();
    expect(state.document.revision).toBe("2");
    expect(["left", "right"]).toContain(state.description);
  });

  it("lets exactly one of two concurrent first saves win", async () => {
    const results = await Promise.allSettled([
      putTaskDocument(taskId, owner.userId, { content: doc("left"), baseRevision: 0 }),
      putTaskDocument(taskId, collaborator.userId, { content: doc("right"), baseRevision: 0 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await stored()).document.revision).toBe("1");
  });
});

describe("save boundaries", () => {
  it("refuses strangers without writing anything", async () => {
    await expect(putTaskDocument(taskId, stranger.userId, { content: doc("x"), baseRevision: 0 }))
      .rejects.toMatchObject({ statusCode: 404 });
    const state = await stored();
    expect(state).toMatchObject({ description: "First line\nsecond\n\nNext", document: undefined, activity: [] });
  });

  it("validates the base revision and the content", async () => {
    for (const baseRevision of [-1, 1.5, "1", null, undefined]) {
      await expect(putTaskDocument(taskId, owner.userId, { content: doc("x"), baseRevision }))
        .rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    }
    await expect(putTaskDocument(taskId, owner.userId, { content: { type: "doc", content: [{ type: "script" }] }, baseRevision: 0 }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", details: [{ path: "content.content[0]" }] });
    await expect(putTaskDocument(taskId, owner.userId, null)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await stored()).document).toBeUndefined();
  });

  it("names referenced tasks from the same collection only", async () => {
    const sibling = await insertTask(owner, "Sibling step");
    const foreign = await insertTask(stranger, "Someone else's secret");
    const ref = (id: string, blockId: string) => ({ type: "taskReference", attrs: { taskId: id, blockId } });
    const content = { type: "doc", content: [...doc("Steps").content, ref(sibling, "a"), ref(foreign, "b")] };

    await putTaskDocument(taskId, owner.userId, { content, baseRevision: 0 });
    expect((await stored()).description).toBe("Steps\n\nSibling step");
  });

  it("authorizes by collection membership so the owner can edit collaborator-created tasks and removed collaborators cannot", async () => {
    const collabTaskRes = await pool.query<{ id: string }>(
      "INSERT INTO tasks (user_id, collection_id, title, description, order_value) VALUES ($1, $2, 'Collab task', 'Seed', 0) RETURNING id",
      [collaborator.userId, owner.collectionId],
    );
    const collabTaskId = collabTaskRes.rows[0].id;

    // Collection owner can read and write a task created by a collaborator
    await expect(getTaskDocument(collabTaskId, owner.userId)).resolves.toMatchObject({ revision: 0 });
    await expect(putTaskDocument(collabTaskId, owner.userId, { content: doc("Owner edit"), baseRevision: 0 }))
      .resolves.toMatchObject({ revision: 1 });

    // Once removed from collaborators, the creator loses access to the task in the owner's collection
    await pool.query("DELETE FROM collaborators WHERE collection_id = $1 AND user_id = $2", [owner.collectionId, collaborator.userId]);
    await expect(getTaskDocument(collabTaskId, collaborator.userId)).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    await expect(putTaskDocument(collabTaskId, collaborator.userId, { content: doc("Ex-collab"), baseRevision: 1 }))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  it("serializes concurrent updateTask description writes and putTaskDocument so description and document never diverge", async () => {
    const [docRes, patchRes] = await Promise.allSettled([
      putTaskDocument(taskId, owner.userId, { content: doc("Rich winner"), baseRevision: 0 }),
      updateTask(taskId, owner.userId, { description: "Plain contender" }),
    ]);

    expect(docRes.status).toBe("fulfilled");
    if (patchRes.status === "rejected") {
      expect(patchRes.reason).toMatchObject({ code: "DOCUMENT_EXISTS", statusCode: 409 });
    }
    const state = await stored();
    expect(state.document).toEqual({ revision: "1", updated_by: owner.userId });
    expect(state.description).toBe("Rich winner");
  });

  it("keeps the document and every descendant when a task becomes a note and back, or is renamed", async () => {
    await putTaskDocument(taskId, owner.userId, { content: doc("Durable plan"), baseRevision: 0 });
    const child = await pool.query<{ id: string }>(
      "INSERT INTO tasks (user_id, collection_id, parent_task_id, title, depth, order_value) VALUES ($1, $2, $3, 'Child', 1, 0) RETURNING id",
      [owner.userId, owner.collectionId, taskId],
    );

    await updateTask(taskId, owner.userId, { type: "note" });
    await updateTask(taskId, owner.userId, { title: "Renamed" });
    await updateTask(taskId, owner.userId, { type: "task" });

    const { document } = await getTaskDocument(taskId, owner.userId).then((dto) => ({ document: dto }));
    expect(document).toMatchObject({ revision: 1, content: doc("Durable plan") });
    const kept = await pool.query("SELECT id FROM tasks WHERE id = $1", [child.rows[0].id]);
    expect(kept.rows).toHaveLength(1);
  });
});
