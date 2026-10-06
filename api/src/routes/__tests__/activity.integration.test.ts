import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createSession, buildCookieName } from "../../services/sessionService.js";
import { createPersonalToken, revokePersonalToken } from "../../services/apiTokenService.js";
import app from "../../index.js";

const API = "/api/v1";

let userId: string;
let otherUserId: string;
let sessionCookie: string;

async function createUser(): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [id, `activity-${id}@example.com`]);
  await pool.query("INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true)", [id]);
  return id;
}

async function token(name: string, forUser = userId): Promise<{ id: string; auth: string }> {
  const { token: created, rawToken } = await createPersonalToken(forUser, { name, scopes: ["read", "write"], expiresInDays: 30 });
  return { id: created.id, auth: `Bearer ${rawToken}` };
}

async function createTaskWith(auth: string, title: string): Promise<string> {
  const res = await request(app).post(`${API}/tasks`).set("Authorization", auth).send({ title });
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("activity attribution through the real app (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = await createUser();
    otherUserId = await createUser();
    sessionCookie = `${buildCookieName()}=${await createSession(userId)}`;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[userId, otherUserId]]);
  });

  it("records the token and its name on everything a token does", async () => {
    const agent = await token("Claude Desktop");
    const taskId = await createTaskWith(agent.auth, "Agent task");
    await request(app).patch(`${API}/tasks/${taskId}`).set("Authorization", agent.auth).send({ title: "Agent task v2", priority: 1 });
    await request(app).post(`${API}/tasks/${taskId}/complete`).set("Authorization", agent.auth).send({});
    await request(app).delete(`${API}/tasks/${taskId}`).set("Authorization", agent.auth).send({});

    const rows = await pool.query(
      `SELECT event_type, actor_type, api_token_id, actor_label, after_data
       FROM activity_events WHERE entity_id = $1 ORDER BY created_at`,
      [taskId],
    );

    expect(rows.rows.map((r) => r.event_type)).toEqual(["task_created", "task_updated", "task_completed", "task_deleted"]);
    for (const row of rows.rows) {
      expect(row).toMatchObject({ actor_type: "token", api_token_id: agent.id, actor_label: "Claude Desktop" });
    }
    expect(rows.rows[1].after_data).toEqual({ title: "Agent task v2", fields: ["title", "priority"] });
  });

  it("records browser changes as session activity", async () => {
    const primer = await request(app).get(`${API}/views/inbox`).set("Cookie", sessionCookie);
    const csrf = (primer.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("planner_csrf="))!.split(";")[0];

    const res = await request(app)
      .post(`${API}/tasks`)
      .set("Cookie", [sessionCookie, csrf])
      .set("X-XSRF-TOKEN", decodeURIComponent(csrf.split("=")[1]).split(":")[0])
      .send({ title: "Typed in the app" });

    const row = await pool.query("SELECT actor_type, api_token_id, actor_label FROM activity_events WHERE entity_id = $1", [res.body.id]);
    expect(row.rows).toEqual([{ actor_type: "session", api_token_id: null, actor_label: null }]);
  });

  it("filters by token and by any-token source, with titles and the label kept after revocation", async () => {
    const desktop = await token("Claude Desktop");
    const cursor = await token("Cursor");
    await createTaskWith(desktop.auth, "From desktop");
    await createTaskWith(cursor.auth, "From cursor");
    await revokePersonalToken(userId, desktop.id);

    const byToken = await request(app).get(`${API}/activity?token_id=${desktop.id}`).set("Cookie", sessionCookie);
    expect(byToken.status).toBe(200);
    expect(byToken.body.events).toHaveLength(1);
    expect(byToken.body.events[0]).toMatchObject({
      eventType: "task_created",
      title: "From desktop",
      actor: { type: "token", tokenId: desktop.id, label: "Claude Desktop" },
    });

    const agents = await request(app).get(`${API}/activity?source=token`).set("Cookie", sessionCookie);
    expect(agents.body.events.map((e: { title: string }) => e.title)).toEqual(["From cursor", "From desktop"]);
  });

  it("falls back to the live task title for older events without a snapshot", async () => {
    const agent = await token("Agent");
    const taskId = await createTaskWith(agent.auth, "Original");
    await pool.query("UPDATE activity_events SET after_data = NULL WHERE entity_id = $1", [taskId]);
    await pool.query("UPDATE tasks SET title = 'Renamed' WHERE id = $1", [taskId]);

    const res = await request(app).get(`${API}/activity?token_id=${agent.id}`).set("Cookie", sessionCookie);

    expect(res.body.events[0].title).toBe("Renamed");
  });

  it("does not reveal the live title of a task the caller can no longer see", async () => {
    const agent = await token("Agent");
    const taskId = await createTaskWith(agent.auth, "Original");
    await pool.query("UPDATE activity_events SET after_data = NULL WHERE entity_id = $1", [taskId]);
    // The task now belongs to someone else (e.g. moved out of a shared collection).
    const otherInbox = await pool.query("SELECT id FROM collections WHERE user_id = $1", [otherUserId]);
    await pool.query("UPDATE tasks SET user_id = $1, collection_id = $2, title = 'Secret' WHERE id = $3", [
      otherUserId,
      otherInbox.rows[0].id,
      taskId,
    ]);

    const res = await request(app).get(`${API}/activity?token_id=${agent.id}`).set("Cookie", sessionCookie);

    expect(res.body.events[0].title).toBeNull();
  });

  it("refuses another user's token id and malformed ids", async () => {
    const foreign = await token("Theirs", otherUserId);

    const notMine = await request(app).get(`${API}/activity?token_id=${foreign.id}`).set("Cookie", sessionCookie);
    const malformed = await request(app).get(`${API}/activity?token_id=nope`).set("Cookie", sessionCookie);

    expect(notMine.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});
