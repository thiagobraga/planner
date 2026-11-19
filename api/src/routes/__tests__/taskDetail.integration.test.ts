import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import app from "../../index.js";

const API = "/api/v1";

let ownerId: string;
let collaboratorId: string;
let strangerId: string;
let auth: string;

async function createUser(): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [id, `detail-${id}@example.com`]);
  await pool.query("INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true)", [id]);
  return id;
}

async function bearer(userId: string): Promise<string> {
  const { rawToken } = await createPersonalToken(userId, { name: "Agent", scopes: ["read", "write"], expiresInDays: 30 });
  return `Bearer ${rawToken}`;
}

async function create(body: Record<string, unknown>, token = auth): Promise<string> {
  const res = await request(app).post(`${API}/tasks`).set("Authorization", token).send(body);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("GET /tasks/:id through the real app (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    ownerId = await createUser();
    collaboratorId = await createUser();
    strangerId = await createUser();
    auth = await bearer(ownerId);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[ownerId, collaboratorId, strangerId]]);
  });

  it("returns the task, its multi-level ancestors root first and every descendant in order, completed ones included", async () => {
    const root = await create({ title: "Milestone" });
    const parent = await create({ title: "Slice", parentTaskId: root });
    const leafA = await create({ title: "Write tests", parentTaskId: parent });
    const leafB = await create({ title: "Ship", parentTaskId: parent });
    const note = await create({ title: "Context", parentTaskId: parent, type: "note" });
    const grandchild = await create({ title: "Unit", parentTaskId: leafA });
    expect((await request(app).post(`${API}/tasks/${leafB}/complete`).set("Authorization", auth).send({})).status).toBe(200);

    // Check 2-level ancestors root-first on grandchild
    const deepRes = await request(app).get(`${API}/tasks/${grandchild}`).set("Authorization", auth);
    expect(deepRes.status).toBe(200);
    expect(deepRes.body.ancestors).toEqual([
      { id: root, title: "Milestone" },
      { id: parent, title: "Slice" },
      { id: leafA, title: "Write tests" },
    ]);

    const res = await request(app).get(`${API}/tasks/${parent}`).set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ id: parent, title: "Slice", parentTaskId: root, type: "task", isCompleted: false });
    expect(res.body.ancestors).toEqual([{ id: root, title: "Milestone" }]);
    expect(res.body.descendants.map((t: { id: string }) => t.id)).toEqual([leafA, leafB, note, grandchild]);
    const byId = new Map<string, Record<string, unknown>>(res.body.descendants.map((t: { id: string }) => [t.id, t]));
    expect(byId.get(leafB)).toMatchObject({ isCompleted: true, parentTaskId: parent });
    expect(byId.get(note)).toMatchObject({ type: "note" });
    expect(byId.get(grandchild)).toMatchObject({ parentTaskId: leafA });
  });

  it("allows collaborators and collection owners to read shared tasks, and blocks revoked collaborators", async () => {
    const colRes = await pool.query<{ id: string }>(
      "INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Shared', '#65788a', false) RETURNING id",
      [ownerId],
    );
    const sharedCollectionId = colRes.rows[0].id;
    await pool.query(
      "INSERT INTO collaborators (collection_id, user_id) VALUES ($1, $2)",
      [sharedCollectionId, collaboratorId],
    );

    const collabAuth = await bearer(collaboratorId);
    const ownerTask = await create({ title: "Owner task", collectionId: sharedCollectionId }, auth);
    const collabTask = await create({ title: "Collab task", collectionId: sharedCollectionId, parentTaskId: ownerTask }, collabAuth);

    // Active collaborator can read owner's task
    expect((await request(app).get(`${API}/tasks/${ownerTask}`).set("Authorization", collabAuth)).status).toBe(200);
    // Collection owner can read collaborator-created task
    const ownerReadCollab = await request(app).get(`${API}/tasks/${collabTask}`).set("Authorization", auth);
    expect(ownerReadCollab.status).toBe(200);
    expect(ownerReadCollab.body.ancestors).toEqual([{ id: ownerTask, title: "Owner task" }]);

    // Once removed from collaborators, the former collaborator cannot read even the task they created
    await pool.query("DELETE FROM collaborators WHERE collection_id = $1 AND user_id = $2", [sharedCollectionId, collaboratorId]);
    const revokedRes = await request(app).get(`${API}/tasks/${collabTask}`).set("Authorization", collabAuth);
    expect(revokedRes.status).toBe(404);
    expect(revokedRes.body.error.code).toBe("NOT_FOUND");
  });

  it("does not leak ancestor titles across collections or duplicate rows on corrupt parent cycles", async () => {
    const privateParent = await create({ title: "Secret parent" });
    const sharedCol = await pool.query<{ id: string }>(
      "INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Shared2', '#65788a', false) RETURNING id",
      [ownerId],
    );
    const child = await create({ title: "Moved child", parentTaskId: privateParent });
    // Simulate a task moved to another collection while retaining parent_task_id
    await pool.query("UPDATE tasks SET collection_id = $1 WHERE id = $2", [sharedCol.rows[0].id, child]);

    const crossColRes = await request(app).get(`${API}/tasks/${child}`).set("Authorization", auth);
    expect(crossColRes.status).toBe(200);
    expect(crossColRes.body.ancestors).toEqual([]);

    // Inject a corrupt 2-node parent cycle A <-> B in the same collection and verify termination without duplicates
    const cycleA = await create({ title: "Cycle A" });
    const cycleB = await create({ title: "Cycle B", parentTaskId: cycleA });
    await pool.query("UPDATE tasks SET parent_task_id = $1 WHERE id = $2", [cycleB, cycleA]);

    const cycleRes = await request(app).get(`${API}/tasks/${cycleA}`).set("Authorization", auth);
    expect(cycleRes.status).toBe(200);
    expect(cycleRes.body.ancestors).toEqual([{ id: cycleB, title: "Cycle B" }]);
    expect(cycleRes.body.descendants.map((t: { id: string }) => t.id)).toEqual([cycleB]);
  });

  it("answers 404 with NOT_FOUND for another account's task, a missing UUID and a malformed id", async () => {
    const own = await create({ title: "Private" });
    const stranger = await bearer(strangerId);

    const crossUser = await request(app).get(`${API}/tasks/${own}`).set("Authorization", stranger);
    expect(crossUser.status).toBe(404);
    expect(crossUser.body.error.code).toBe("NOT_FOUND");

    const missing = await request(app).get(`${API}/tasks/${crypto.randomUUID()}`).set("Authorization", auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");

    const malformed = await request(app).get(`${API}/tasks/not-a-uuid`).set("Authorization", auth);
    expect(malformed.status).toBe(404);
    expect(malformed.body.error.code).toBe("NOT_FOUND");
  });

  it("answers 404 once the task is deleted", async () => {
    const own = await create({ title: "Gone" });
    expect((await request(app).delete(`${API}/tasks/${own}`).set("Authorization", auth).send({})).status).toBeLessThan(300);

    expect((await request(app).get(`${API}/tasks/${own}`).set("Authorization", auth)).status).toBe(404);
  });
});
