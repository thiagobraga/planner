import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createSession, buildCookieName } from "../../services/sessionService.js";
import app from "../../index.js";

const API = "/api/v1";
const SESSION_COOKIE = buildCookieName();

let userId: string;
let sessionCookie: string;

async function createUser(): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [
    id,
    `api-token-route-${id}@example.com`,
  ]);
  await pool.query(
    "INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true)",
    [id],
  );
  return id;
}

/** A browser-style write: session cookie plus the double-submit CSRF pair. */
async function sessionWrite(method: "post" | "delete", path: string, body: object = {}) {
  const primer = await request(app).get(`${API}/api-tokens`).set("Cookie", sessionCookie);
  const csrfCookie = (primer.headers["set-cookie"] as unknown as string[])
    .find((c) => c.startsWith("planner_csrf="))!
    .split(";")[0];
  const csrfToken = decodeURIComponent(csrfCookie.split("=")[1]).split(":")[0];
  return request(app)[method](`${API}${path}`)
    .set("Cookie", [sessionCookie, csrfCookie])
    .set("X-XSRF-TOKEN", csrfToken)
    .send(body);
}

async function mintToken(scopes: string[]): Promise<{ id: string; raw: string }> {
  const res = await sessionWrite("post", "/api-tokens", { name: "agent", scopes, expiresInDays: 30 });
  expect(res.status).toBe(201);
  return { id: res.body.token.id, raw: res.body.rawToken };
}

describe("API token auth through the real app (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = await createUser();
    sessionCookie = `${SESSION_COOKIE}=${await createSession(userId)}`;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("creates a token with a session and reads with it as a bearer", async () => {
    const { raw } = await mintToken(["read"]);

    const res = await request(app).get(`${API}/views/inbox`).set("Authorization", `Bearer ${raw}`);

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("lets a write token create a task with no CSRF header or cookie", async () => {
    const { raw } = await mintToken(["read", "write"]);

    const res = await request(app)
      .post(`${API}/tasks`)
      .set("Authorization", `Bearer ${raw}`)
      .send({ title: "Made by an agent" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Made by an agent");
  });

  it("blocks writes from a read-only token", async () => {
    const { raw } = await mintToken(["read"]);

    const res = await request(app)
      .post(`${API}/tasks`)
      .set("Authorization", `Bearer ${raw}`)
      .send({ title: "Nope" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("keeps token management and admin out of a token's reach", async () => {
    const { raw } = await mintToken(["read", "write"]);
    const auth = { Authorization: `Bearer ${raw}` };

    const list = await request(app).get(`${API}/api-tokens`).set(auth);
    const mint = await request(app).post(`${API}/api-tokens`).set(auth).send({ name: "x", scopes: ["read"], expiresInDays: 30 });
    const admin = await request(app).get(`${API}/admin/users`).set(auth);

    expect(list.status).toBe(403);
    expect(mint.status).toBe(403);
    expect(admin.status).toBe(403);
    expect([list, mint, admin].map((r) => r.body.error.code)).toEqual(
      ["SESSION_REQUIRED", "SESSION_REQUIRED", "SESSION_REQUIRED"],
    );
  });

  it("stops accepting a token the moment it is revoked", async () => {
    const { id, raw } = await mintToken(["read"]);

    const revoke = await sessionWrite("delete", `/api-tokens/${id}`);
    expect(revoke.status).toBe(204);

    const res = await request(app).get(`${API}/views/inbox`).set("Authorization", `Bearer ${raw}`);
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="planner"');
  });

  it("lists tokens for the session without exposing the raw value", async () => {
    await mintToken(["read"]);

    const res = await request(app).get(`${API}/api-tokens`).set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).not.toHaveProperty("rawToken");
    expect(res.body[0].tokenPrefix).toMatch(/^plnr_/);
  });

  it("rejects requests with no credentials with a bearer challenge", async () => {
    const res = await request(app).get(`${API}/views/inbox`);

    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="planner"');
  });
});
