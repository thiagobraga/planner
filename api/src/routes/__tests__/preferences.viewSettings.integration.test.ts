import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import preferencesRoutes from "../preferences.js";

const userId = randomUUID();
const collectionA = randomUUID();
const collectionB = randomUUID();
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.userId = userId; next(); });
app.use("/preferences", preferencesRoutes);
app.use(errorHandler);

describe("view settings preferences (real PostgreSQL and Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
    await pool.query(
      "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, 'test-only', 'View settings test')",
      [userId, `views-${userId}@example.com`],
    );
    await pool.query("INSERT INTO preferences (user_id) VALUES ($1)", [userId]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  it("defaults Daily to Notebook, This week and normal width", async () => {
    const { body } = await request(app).get("/preferences");
    expect(body.dailyView).toEqual({ style: "notebook", range: "week" });
    expect(body.fullWidth).toBe(false);
    expect(body.alignTaskItemsRight).toBe(false);
  });

  it("persists the Daily view, full width and task item alignment", async () => {
    const response = await request(app).patch("/preferences").send({
      dailyView: { style: "cards", range: "d3" },
      fullWidth: true,
      alignTaskItemsRight: true,
    });
    expect(response.status).toBe(200);
    const { body } = await request(app).get("/preferences");
    expect(body.dailyView).toEqual({ style: "cards", range: "d3" });
    expect(body.fullWidth).toBe(true);
    expect(body.alignTaskItemsRight).toBe(true);
  });

  it("rejects unknown styles and ranges", async () => {
    for (const dailyView of [{ style: "grid", range: "week" }, { style: "cards", range: "d9" }, { style: "cards" }, "week"]) {
      const response = await request(app).patch("/preferences").send({ dailyView });
      expect(response.status).toBe(400);
    }
    expect((await request(app).patch("/preferences").send({ fullWidth: "yes" })).status).toBe(400);
    expect((await request(app).patch("/preferences").send({ alignTaskItemsRight: "yes" })).status).toBe(400);
  });

  it("merges a board entry instead of replacing it or its siblings", async () => {
    await request(app).patch("/preferences").send({
      boardViewModes: { [collectionA]: { layout: "columns", style: "cards", groupBy: "section" } },
    }).expect(200);
    await request(app).patch("/preferences").send({
      boardViewModes: { [collectionB]: { groupBy: "priority" } },
    }).expect(200);
    const response = await request(app).patch("/preferences").send({
      boardViewModes: { [collectionA]: { groupBy: "status" } },
    });

    expect(response.status).toBe(200);
    expect(response.body.boardViewModes).toEqual({
      [collectionA]: { layout: "columns", style: "cards", groupBy: "status" },
      [collectionB]: { groupBy: "priority" },
    });
  });

  it("accepts the Inbox groupings and rejects unknown layouts", async () => {
    expect((await request(app).patch("/preferences").send({
      boardViewModes: { [collectionB]: { groupBy: "collection" } },
    })).status).toBe(200);
    expect((await request(app).patch("/preferences").send({
      boardViewModes: { [collectionB]: { layout: "kanban" } },
    })).status).toBe(400);
  });
});
