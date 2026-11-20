import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import type { ApiTokenScope } from "../../types/apiToken.js";
import app from "../../index.js";

const API = "/api/v1";
let ownerId: string;
let collectionId: string;

async function createUser(): Promise<{ id: string; collectionId: string }> {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [id, `imports-${id}@example.com`]);
  const col = await pool.query<{ id: string }>("INSERT INTO collections (user_id, name, color) VALUES ($1, 'Dev', '#bababa') RETURNING id", [id]);
  return { id, collectionId: col.rows[0].id };
}

async function bearer(userId: string, scopes: ApiTokenScope[] = ["read", "write"]): Promise<string> {
  const { rawToken } = await createPersonalToken(userId, { name: "Importer", scopes, expiresInDays: 30 });
  return `Bearer ${rawToken}`;
}

const body = () => ({ sourcePath: ".specs/demo", title: "Demo", plan: "Intro\n- [ ] One\n- [x] Two", collectionId });

describe("import routes through the real app (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    ({ id: ownerId, collectionId } = await createUser());
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [ownerId]);
  });

  it("previews, applies once, returns the same import on retry and undoes it", async () => {
    const auth = await bearer(ownerId);
    const preview = await request(app).post(`${API}/imports/markdown/preview`).set("Authorization", auth).send(body());
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ subtasks: 2, completed: 1, existingManifestId: null });

    const created = await request(app).post(`${API}/imports/markdown`).set("Authorization", auth).send(body());
    expect(created.status).toBe(201);
    const retry = await request(app).post(`${API}/imports/markdown`).set("Authorization", auth).send(body());
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ manifestId: created.body.manifestId, deduplicated: true });

    const undo = await request(app).delete(`${API}/imports/${created.body.manifestId}`).set("Authorization", auth).send({});
    expect(undo.status).toBe(200);
    expect(undo.body.deleted).toHaveLength(3);
  });

  it("rejects bad input at the boundary and keeps read-only tokens out", async () => {
    const auth = await bearer(ownerId);
    const bad = await request(app).post(`${API}/imports/markdown`).set("Authorization", auth).send({ ...body(), collectionId: "nope" });
    expect(bad.status).toBe(400);
    const reader = await bearer(ownerId, ["read"]);
    const denied = await request(app).post(`${API}/imports/markdown`).set("Authorization", reader).send(body());
    expect(denied.status).toBe(403);
  });

  it("accepts a spec larger than the default 100kb JSON limit", async () => {
    const auth = await bearer(ownerId);
    const plan = Array.from({ length: 1500 }, (_, i) => `Paragraph ${i} ${"words ".repeat(14)}`).join("\n\n");
    const res = await request(app).post(`${API}/imports/markdown/preview`).set("Authorization", auth).send({ ...body(), plan });
    expect(res.status).toBe(200);
  });
});
