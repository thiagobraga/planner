import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import viewRoutes from "../views.js";

const userId = randomUUID();
const inboxId = randomUUID();
const collectionId = randomUUID();
const app = express();
app.use((req, _res, next) => { req.userId = userId; next(); });
app.use("/views", viewRoutes);
app.use(errorHandler);

const titles = (body: { tasks: { title: string }[] }) => body.tasks.map((task) => task.title).sort();

describe("views include_completed (real PostgreSQL)", () => {
  beforeAll(async () => {
    await connectRedis();
    await pool.query(
      "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, 'test-only', 'Views test')",
      [userId, `views-${userId}@example.com`],
    );
    await pool.query("INSERT INTO preferences (user_id, hide_completed_tasks) VALUES ($1, true)", [userId]);
    await pool.query(
      "INSERT INTO collections (id, user_id, name, color, is_inbox) VALUES ($1, $3, 'Inbox', '#888888', true), ($2, $3, 'Casa', '#c9483b', false)",
      [inboxId, collectionId, userId],
    );
    for (const [id, title, done] of [[inboxId, "Inbox open", false], [inboxId, "Inbox done", true], [collectionId, "Open", false], [collectionId, "Done", true]] as const) {
      await pool.query(
        "INSERT INTO tasks (id, user_id, collection_id, title, is_completed) VALUES ($1, $2, $3, $4, $5)",
        [randomUUID(), userId, id, title, done],
      );
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  it("hides completed tasks by preference", async () => {
    expect(titles((await request(app).get(`/views/collection/${collectionId}`)).body)).toEqual(["Open"]);
    expect(titles((await request(app).get("/views/inbox")).body)).toEqual(["Inbox open"]);
  });

  it("returns them when a status board asks for its completion column", async () => {
    expect(titles((await request(app).get(`/views/collection/${collectionId}?include_completed=true`)).body)).toEqual(["Done", "Open"]);
    expect(titles((await request(app).get("/views/inbox?include_completed=true")).body)).toEqual(["Inbox done", "Inbox open"]);
  });
});
