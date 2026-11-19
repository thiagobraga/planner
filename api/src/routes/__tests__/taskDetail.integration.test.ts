import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import app from "../../index.js";

const API = "/api/v1";

let ownerId: string;
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

async function create(body: Record<string, unknown>): Promise<string> {
  const res = await request(app).post(`${API}/tasks`).set("Authorization", auth).send(body);
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
    strangerId = await createUser();
    auth = await bearer(ownerId);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[ownerId, strangerId]]);
  });

  it("returns the task, its ancestors root first and every descendant, completed ones included", async () => {
    const root = await create({ title: "Milestone" });
    const parent = await create({ title: "Slice", parentTaskId: root });
    const leafA = await create({ title: "Write tests", parentTaskId: parent });
    const leafB = await create({ title: "Ship", parentTaskId: parent });
    const note = await create({ title: "Context", parentTaskId: parent, type: "note" });
    const grandchild = await create({ title: "Unit", parentTaskId: leafA });
    expect((await request(app).post(`${API}/tasks/${leafB}/complete`).set("Authorization", auth).send({})).status).toBe(200);

    const res = await request(app).get(`${API}/tasks/${parent}`).set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ id: parent, title: "Slice", parentTaskId: root, type: "task", isCompleted: false });
    expect(res.body.ancestors).toEqual([{ id: root, title: "Milestone" }]);
    const byId = new Map<string, Record<string, unknown>>(res.body.descendants.map((t: { id: string }) => [t.id, t]));
    expect([...byId.keys()].sort()).toEqual([leafA, leafB, note, grandchild].sort());
    expect(byId.get(leafB)).toMatchObject({ isCompleted: true, parentTaskId: parent });
    expect(byId.get(note)).toMatchObject({ type: "note" });
    expect(byId.get(grandchild)).toMatchObject({ parentTaskId: leafA });
  });

  it("answers 404 for another account's task and for a malformed id", async () => {
    const own = await create({ title: "Private" });
    const stranger = await bearer(strangerId);

    expect((await request(app).get(`${API}/tasks/${own}`).set("Authorization", stranger)).status).toBe(404);
    expect((await request(app).get(`${API}/tasks/not-a-uuid`).set("Authorization", auth)).status).toBe(404);
  });

  it("answers 404 once the task is deleted", async () => {
    const own = await create({ title: "Gone" });
    expect((await request(app).delete(`${API}/tasks/${own}`).set("Authorization", auth).send({})).status).toBeLessThan(300);

    expect((await request(app).get(`${API}/tasks/${own}`).set("Authorization", auth)).status).toBe(404);
  });
});
