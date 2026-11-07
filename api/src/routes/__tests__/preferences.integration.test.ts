import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { exportUserData } from "../../services/accountService.js";
import preferencesRoutes from "../preferences.js";

const userId = randomUUID();
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.userId = userId; next(); });
app.use("/preferences", preferencesRoutes);
app.use(errorHandler);
const events: { userId: string; entityType: string; payload: { navStyle: string } }[] = [];

describe("navigation preferences (real PostgreSQL and Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
    await redisSubClient.subscribe("sync", (message) => { events.push(JSON.parse(message)); });
    await pool.query(
      "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, 'test-only', 'Navigation test')",
      [userId, `nav-${userId}@example.com`],
    );
    await pool.query("INSERT INTO preferences (user_id) VALUES ($1)", [userId]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await redisSubClient.unsubscribe("sync");
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  it("defaults to icon-left", async () => {
    const response = await request(app).get("/preferences");
    expect(response.status).toBe(200);
    expect(response.body.navStyle).toBe("icon-left");
  });

  it.each(["text", "icon-left", "icon-top"])("persists and broadcasts %s", async (navStyle) => {
    events.length = 0;
    const response = await request(app).patch("/preferences").send({ navStyle });
    expect(response.status).toBe(200);
    expect(response.body.navStyle).toBe(navStyle);
    expect((await request(app).get("/preferences")).body.navStyle).toBe(navStyle);
    await vi.waitFor(() => expect(events).toContainEqual(expect.objectContaining({
      userId, entityType: "preferences", payload: expect.objectContaining({ navStyle }),
    })));
  });

  it.each(["sidebar", "", null, 1, true, [], {}].map((value) => [value]))("rejects invalid style %j without changing saved value", async (navStyle) => {
    const before = (await request(app).get("/preferences")).body;
    const response = await request(app).patch("/preferences").send({ navStyle });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect((await request(app).get("/preferences")).body.navStyle).toBe(before.navStyle);
  });

  it("exports the style and restores it through preferences", async () => {
    await request(app).patch("/preferences").send({ navStyle: "text" });
    const exported = await exportUserData(userId);
    expect(exported.preferences).toMatchObject({ navStyle: "text" });
    await request(app).patch("/preferences").send({ navStyle: "icon-top" });
    const response = await request(app).patch("/preferences").send(exported.preferences!);
    expect(response.status).toBe(200);
    expect(response.body.navStyle).toBe("text");
  });
});
