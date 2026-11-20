import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { redisClient, redisPubClient } from "../../db/redis.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import type { SyncEvent } from "../syncService.js";
import { createComment, deleteComment, listComments, updateComment } from "../commentService.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;

let owner: Fixture;
let collaborator: Fixture;
let stranger: Fixture;
let taskId: string;
const subscriber = redisClient.duplicate();
let events: SyncEvent[] = [];

beforeAll(async () => {
  await redisPubClient.connect();
  await subscriber.connect();
  // Comments go to current collection members, resolved at dispatch.
  await subscriber.subscribe("sync:collection-members", (message) => {
    const event = JSON.parse(message) as SyncEvent;
    if (event.entityType === "comment") events.push(event);
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
  await pool.query("INSERT INTO collaborators (collection_id, user_id) VALUES ($1, $2)", [
    owner.collectionId,
    collaborator.userId,
  ]);
  const task = await pool.query<{ id: string }>(
    "INSERT INTO tasks (user_id, collection_id, title, order_value) VALUES ($1, $2, 'Shared task', 0) RETURNING id",
    [owner.userId, owner.collectionId],
  );
  taskId = task.rows[0].id;
});

afterEach(async () => {
  await owner.cleanup();
  await collaborator.cleanup();
  await stranger.cleanup();
});

function commentEvents() {
  return events.map(({ eventType, entityId, userId, collectionId, audience, payload }) =>
    ({ eventType, entityId, userId, collectionId, audience, payload }));
}

describe("comment sync", () => {
  it("publishes created, updated and deleted events for the task's collection", async () => {
    const comment = await createComment(taskId, collaborator.userId, "First pass");
    const edited = await updateComment(comment.id, collaborator.userId, "Second pass");
    await deleteComment(comment.id, owner.userId);

    expect(edited.body).toBe("Second pass");
    expect(edited.updatedAt).not.toBeNull();
    const base = { entityId: comment.id, collectionId: owner.collectionId, audience: "current-collection-members", payload: { taskId } };
    await expect.poll(commentEvents).toEqual([
      { ...base, eventType: "created", userId: collaborator.userId },
      { ...base, eventType: "updated", userId: collaborator.userId },
      { ...base, eventType: "deleted", userId: owner.userId },
    ]);
  });

  it("keeps the comment body off the broadcast", async () => {
    await createComment(taskId, owner.userId, "private words");
    await expect.poll(() => events.length).toBe(1);
    expect(JSON.stringify(events[0])).not.toContain("private words");
  });

  it("publishes nothing when the caller is refused", async () => {
    const comment = await createComment(taskId, owner.userId, "Owner note");
    await expect.poll(() => events.length).toBe(1);

    await expect(createComment(taskId, stranger.userId, "hi")).rejects.toMatchObject({ statusCode: 404 });
    await expect(updateComment(comment.id, collaborator.userId, "edit")).rejects.toMatchObject({ statusCode: 403 });
    await expect(deleteComment(comment.id, stranger.userId)).rejects.toMatchObject({ statusCode: 404 });

    // A later event proves the refused calls had their chance to publish.
    await updateComment(comment.id, owner.userId, "Owner edit");
    await expect.poll(() => events.map((e) => e.eventType)).toEqual(["created", "updated"]);
    const stored = await pool.query("SELECT body FROM comments WHERE id = $1", [comment.id]);
    expect(stored.rows[0].body).toBe("Owner edit");
  });
});

describe("comment rules", () => {
  it("lists a task's comments oldest first for members and hides them from others", async () => {
    const first = await createComment(taskId, owner.userId, "one");
    const second = await createComment(taskId, collaborator.userId, "two");

    expect((await listComments(taskId, collaborator.userId)).map((c) => c.id)).toEqual([first.id, second.id]);
    await expect(listComments(taskId, stranger.userId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("validates the body length and strips markup", async () => {
    await expect(createComment(taskId, owner.userId, "")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createComment(taskId, owner.userId, "x".repeat(15001))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const comment = await createComment(taskId, owner.userId, "<b>bold</b><script>x</script>");
    expect(comment.body).toBe("bold");
  });

  it("lets the author or the task owner delete, and nobody else", async () => {
    const byOwner = await createComment(taskId, owner.userId, "owner's");
    const byCollaborator = await createComment(taskId, collaborator.userId, "collaborator's");

    await expect(deleteComment(byOwner.id, collaborator.userId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(deleteComment(byCollaborator.id, owner.userId)).resolves.toEqual({ success: true });
    await expect(deleteComment(byOwner.id, owner.userId)).resolves.toEqual({ success: true });
    await expect(updateComment(byOwner.id, owner.userId, "gone")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("records activity events when comments are created, updated and deleted", async () => {
    const comment = await createComment(taskId, collaborator.userId, "Initial update");
    await updateComment(comment.id, collaborator.userId, "Revised update");
    await deleteComment(comment.id, owner.userId);

    const rows = await pool.query<{ event_type: string; user_id: string; entity_id: string; after_data: unknown; before_data: unknown }>(
      `SELECT event_type, user_id, entity_id, after_data, before_data
       FROM activity_events
       WHERE entity_id = $1 AND event_type LIKE 'comment_%'
       ORDER BY created_at ASC`,
      [taskId],
    );
    expect(rows.rows).toEqual([
      {
        event_type: "comment_created",
        user_id: collaborator.userId,
        entity_id: taskId,
        after_data: { title: "Shared task", commentId: comment.id },
        before_data: null,
      },
      {
        event_type: "comment_updated",
        user_id: collaborator.userId,
        entity_id: taskId,
        after_data: { title: "Shared task", commentId: comment.id },
        before_data: null,
      },
      {
        event_type: "comment_deleted",
        user_id: owner.userId,
        entity_id: taskId,
        after_data: null,
        before_data: { title: "Shared task", commentId: comment.id },
      },
    ]);
  });
});
