import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import { buildCookieName, createSession } from "../../services/sessionService.js";
import type { ApiTokenScope } from "../../types/apiToken.js";
import app from "../../index.js";

const API = "/api/v1";

let ownerId: string;
let strangerId: string;
let taskId: string;

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function createUser(): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [id, `documents-${id}@example.com`]);
  await pool.query("INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true)", [id]);
  return id;
}

async function bearer(userId: string, scopes: ApiTokenScope[] = ["read", "write"]): Promise<string> {
  const { rawToken } = await createPersonalToken(userId, { name: "Agent", scopes, expiresInDays: 30 });
  return `Bearer ${rawToken}`;
}

const documentUrl = (id = taskId) => `${API}/tasks/${id}/document`;

describe("task document routes through the real app (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    ownerId = await createUser();
    strangerId = await createUser();
    const res = await request(app).post(`${API}/tasks`).set("Authorization", await bearer(ownerId)).send({ title: "Plan", description: "Old notes" });
    expect(res.status).toBe(201);
    taskId = res.body.id;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[ownerId, strangerId]]);
  });

  it("reads the seed, saves revision 1 and reports a stale save as a conflict", async () => {
    const auth = await bearer(ownerId);
    const seed = await request(app).get(documentUrl()).set("Authorization", auth);
    expect(seed.status).toBe(200);
    expect(seed.body).toMatchObject({ taskId, revision: 0, content: doc("Old notes") });

    const saved = await request(app).put(documentUrl()).set("Authorization", auth).send({ content: doc("New"), baseRevision: 0 });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ taskId, revision: 1, content: doc("New") });

    const stale = await request(app).put(documentUrl()).set("Authorization", auth).send({ content: doc("Late"), baseRevision: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({ code: "DOCUMENT_CONFLICT", details: [{ current: { revision: 1, content: doc("New") } }] });
  });

  it("lets a read-only token read but not write", async () => {
    const reader = await bearer(ownerId, ["read"]);
    expect((await request(app).get(documentUrl()).set("Authorization", reader)).status).toBe(200);
    const res = await request(app).put(documentUrl()).set("Authorization", reader).send({ content: doc("x"), baseRevision: 0 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INSUFFICIENT_SCOPE");
    expect((await pool.query("SELECT 1 FROM task_documents WHERE task_id = $1", [taskId])).rows).toHaveLength(0);
  });

  it("answers 404 to other users and to ids that are not task ids", async () => {
    const stranger = await bearer(strangerId);
    expect((await request(app).get(documentUrl()).set("Authorization", stranger)).status).toBe(404);
    expect((await request(app).put(documentUrl()).set("Authorization", stranger).send({ content: doc("x"), baseRevision: 0 })).status).toBe(404);
    const owner = await bearer(ownerId);
    const bad = await request(app).get(documentUrl("not-a-uuid")).set("Authorization", owner);
    expect(bad.status).toBe(404);
    expect(bad.body.error.code).toBe("NOT_FOUND");
  });

  it("requires CSRF for cookie sessions", async () => {
    const cookie = `${buildCookieName()}=${await createSession(ownerId)}`;
    const res = await request(app).put(documentUrl()).set("Cookie", cookie).send({ content: doc("x"), baseRevision: 0 });
    expect(res.status).toBe(403);
  });

  it("rejects invalid documents with the offending path", async () => {
    const res = await request(app)
      .put(documentUrl())
      .set("Authorization", await bearer(ownerId))
      .send({ content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }, baseRevision: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: [{ path: "content.content[0].content[0].marks[0].attrs.href" }] });
  });

  it("accepts documents above the general body limit up to the document limit", async () => {
    const auth = await bearer(ownerId);
    const big = await request(app).put(documentUrl()).set("Authorization", auth).send({ content: doc("x".repeat(200 * 1024)), baseRevision: 0 });
    expect(big.status).toBe(200);
    const tooBig = await request(app).put(documentUrl()).set("Authorization", auth).send({ content: doc("x".repeat(260 * 1024)), baseRevision: 1 });
    expect(tooBig.status).toBe(400);
    const huge = await request(app).put(documentUrl()).set("Authorization", auth).send({ content: doc("x".repeat(400 * 1024)), baseRevision: 1 });
    expect(huge.status).toBe(413);
    const otherRoutes = await request(app).patch(`${API}/tasks/${taskId}`).set("Authorization", auth).send({ title: "x".repeat(200 * 1024) });
    expect(otherRoutes.status).toBe(413);
  });

  describe("legacy description writes", () => {
    it("keep working on tasks without a document", async () => {
      const res = await request(app).patch(`${API}/tasks/${taskId}`).set("Authorization", await bearer(ownerId)).send({ description: "Edited plainly" });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe("Edited plainly");
    });

    it("are refused once a document exists, while other fields still save", async () => {
      const auth = await bearer(ownerId);
      await request(app).put(documentUrl()).set("Authorization", auth).send({ content: doc("Rich"), baseRevision: 0 });

      const blocked = await request(app).patch(`${API}/tasks/${taskId}`).set("Authorization", auth).send({ title: "Renamed", description: "Plain" });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error).toMatchObject({ code: "DOCUMENT_EXISTS", details: [{ revision: 1 }] });
      expect(blocked.body.error.message).toContain(`/tasks/${taskId}/document`);
      const row = await pool.query("SELECT title, description FROM tasks WHERE id = $1", [taskId]);
      expect(row.rows[0]).toEqual({ title: "Plan", description: "Rich" });

      const renamed = await request(app).patch(`${API}/tasks/${taskId}`).set("Authorization", auth).send({ title: "Renamed" });
      expect(renamed.status).toBe(200);
      expect(renamed.body).toMatchObject({ title: "Renamed", description: "Rich" });
    });
  });
});
