import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createSession, buildCookieName } from "../../services/sessionService.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import app from "../../index.js";

const API = "/api/v1";
const SESSION_COOKIE = buildCookieName();

let userId: string;
let otherUserId: string;
let sessionCookie: string;

async function createSeededUser(label: string): Promise<string> {
  const id = crypto.randomUUID();
  const collectionId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const labelId = crypto.randomUUID();
  const habitId = crypto.randomUUID();
  const filterId = crypto.randomUUID();
  const commentId = crypto.randomUUID();
  const reminderId = crypto.randomUUID();

  await pool.query(
    "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)",
    [id, `account-${label}-${id}@example.com`, "$argon2id$secret-hash-value", `User ${label}`],
  );
  await pool.query(
    "INSERT INTO preferences (user_id, time_zone, locale) VALUES ($1, 'UTC', 'en')",
    [id],
  );
  await pool.query(
    "INSERT INTO collections (id, user_id, name, color, is_inbox) VALUES ($1, $2, 'Inbox', '#bababa', true)",
    [collectionId, id],
  );
  await pool.query(
    "INSERT INTO sections (id, collection_id, name, order_value) VALUES ($1, $2, 'To Do', 0)",
    [sectionId, collectionId],
  );
  await pool.query(
    "INSERT INTO tasks (id, user_id, collection_id, section_id, title, description, priority, due_date) VALUES ($1, $2, $3, $4, $5, $6, 2, '2026-08-07')",
    [taskId, id, collectionId, sectionId, `Task for ${label}`, `Notes for ${label}`],
  );
  await pool.query(
    "INSERT INTO labels (id, user_id, name, color) VALUES ($1, $2, $3, '#c9483b')",
    [labelId, id, `tag-${label}`],
  );
  await pool.query(
    "INSERT INTO habits (id, user_id, name, order_value) VALUES ($1, $2, $3, 0)",
    [habitId, id, `Habit ${label}`],
  );
  await pool.query(
    "INSERT INTO habit_completions (habit_id, completed_date) VALUES ($1, '2026-08-07')",
    [habitId],
  );
  await pool.query(
    "INSERT INTO filters (id, user_id, name, query) VALUES ($1, $2, $3, 'p2')",
    [filterId, id, `Filter ${label}`],
  );
  await pool.query(
    "INSERT INTO comments (id, task_id, user_id, body) VALUES ($1, $2, $3, $4)",
    [commentId, taskId, id, `Comment ${label}`],
  );
  await pool.query(
    "INSERT INTO reminders (id, task_id, user_id, remind_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')",
    [reminderId, taskId, id],
  );
  await createPersonalToken(id, { name: "test-token", scopes: ["read", "write"], expiresInDays: 30 });

  return id;
}

async function sessionDelete(path: string) {
  const primer = await request(app).get(`${API}/account/export`).set("Cookie", sessionCookie);
  const csrfCookie = (primer.headers["set-cookie"] as unknown as string[])
    .find((c) => c.startsWith("planner_csrf="))!
    .split(";")[0];
  const csrfToken = decodeURIComponent(csrfCookie.split("=")[1]).split(":")[0];
  return request(app)
    .delete(`${API}${path}`)
    .set("Cookie", [sessionCookie, csrfCookie])
    .set("X-XSRF-TOKEN", csrfToken)
    .send({});
}

describe("Account export and deletion routes (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = await createSeededUser("primary");
    otherUserId = await createSeededUser("other");
    sessionCookie = `${SESSION_COOKIE}=${await createSession(userId)}`;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[userId, otherUserId]]);
  });

  it("GET /account/export returns 401 when unauthenticated", async () => {
    const res = await request(app).get(`${API}/account/export`);
    expect(res.status).toBe(401);
  });

  it("rejects personal API tokens on /account routes with 403 SESSION_REQUIRED", async () => {
    const { rawToken } = await createPersonalToken(userId, {
      name: "cli",
      scopes: ["read", "write"],
      expiresInDays: 30,
    });
    const auth = { Authorization: `Bearer ${rawToken}` };

    const exp = await request(app).get(`${API}/account/export`).set(auth);
    const del = await request(app).delete(`${API}/account`).set(auth).send({});

    expect(exp.status).toBe(403);
    expect(exp.body.error.code).toBe("SESSION_REQUIRED");
    expect(del.status).toBe(403);
    expect(del.body.error.code).toBe("SESSION_REQUIRED");
  });

  it("GET /account/export returns all user data categories and omits sensitive fields", async () => {
    const res = await request(app).get(`${API}/account/export`).set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      email: expect.stringContaining("account-primary-"),
      displayName: "User primary",
      createdAt: expect.any(String),
    });
    expect(res.body.user).not.toHaveProperty("password_hash");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("secret-hash-value");

    expect(res.body.preferences).toMatchObject({
      timeZone: "UTC",
      locale: "en",
    });
    expect(res.body.collections).toHaveLength(1);
    expect(res.body.collections[0].name).toBe("Inbox");
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe("Task for primary");
    expect(res.body.labels).toHaveLength(1);
    expect(res.body.labels[0].name).toBe("tag-primary");
    expect(res.body.sections).toHaveLength(1);
    expect(res.body.sections[0].name).toBe("To Do");
    expect(res.body.habits).toHaveLength(1);
    expect(res.body.habits[0].name).toBe("Habit primary");
    expect(res.body.habitCompletions).toHaveLength(1);
    expect(res.body.habitCompletions[0].completedDate).toBe("2026-08-07");
    expect(res.body.filters).toHaveLength(1);
    expect(res.body.filters[0].name).toBe("Filter primary");
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].body).toBe("Comment primary");
    expect(res.body.reminders).toHaveLength(1);
  });

  it("DELETE /account cascades deletion across all tables, clears cookies, and invalidates session", async () => {
    const del = await sessionDelete("/account");

    expect(del.status).toBe(200);
    expect(del.body).toEqual({ success: true });

    const setCookies = (del.headers["set-cookie"] as unknown as string[]) ?? [];
    expect(setCookies.some((c) => c.startsWith(`${SESSION_COOKIE}=;`))).toBe(true);
    expect(setCookies.some((c) => c.startsWith("planner_csrf=;"))).toBe(true);

    // Verify zero rows remain for the deleted user in all tables
    const tables = [
      ["users", "id"],
      ["preferences", "user_id"],
      ["sessions", "user_id"],
      ["api_tokens", "user_id"],
      ["collections", "user_id"],
      ["tasks", "user_id"],
      ["labels", "user_id"],
      ["habits", "user_id"],
      ["filters", "user_id"],
      ["comments", "user_id"],
      ["reminders", "user_id"],
    ] as const;

    for (const [table, column] of tables) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column} = $1`, [userId]);
      expect(countRes.rows[0].count).toBe(0);
    }

    // Subsequent authenticated request with old session cookie returns 401
    const meRes = await request(app).get(`${API}/auth/me`).set("Cookie", sessionCookie);
    expect(meRes.status).toBe(401);

    // Other user's data is untouched
    const otherTasks = await pool.query("SELECT COUNT(*)::int AS count FROM tasks WHERE user_id = $1", [otherUserId]);
    expect(otherTasks.rows[0].count).toBe(1);
  });
});
