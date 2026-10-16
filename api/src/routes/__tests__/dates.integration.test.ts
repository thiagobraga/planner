import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createSession, buildCookieName } from "../../services/sessionService.js";
import { localDateInTimezone } from "../../services/viewService.js";
import app from "../../index.js";

const API = "/api/v1";

let userId: string;
let sessionCookie: string;

describe("GET /dates/parse (real app)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [
      userId,
      `dates-route-${userId}@example.com`,
    ]);
    await pool.query(
      `INSERT INTO preferences (user_id, time_zone) VALUES ($1, 'Asia/Tokyo')
       ON CONFLICT (user_id) DO UPDATE SET time_zone = EXCLUDED.time_zone`,
      [userId],
    );
    sessionCookie = `${buildCookieName()}=${await createSession(userId)}`;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("parses a Portuguese phrase against the user's own today", async () => {
    const res = await request(app)
      .get(`${API}/dates/parse`)
      .query({ q: "hoje às 15h", locale: "pt-BR" })
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      date: localDateInTimezone(new Date(), "Asia/Tokyo"),
      time: "15:00",
      recurrence: null,
    });
  });

  it("returns the recurrence rule and reads slashes day-first in pt-BR", async () => {
    const recurring = await request(app)
      .get(`${API}/dates/parse`)
      .query({ q: "todo sábado", locale: "pt-BR" })
      .set("Cookie", sessionCookie);
    expect(recurring.body.recurrence).toEqual({ type: "weekly", interval: 1, weekdays: [6] });

    const slashed = await request(app)
      .get(`${API}/dates/parse`)
      .query({ q: "5/1/2027", locale: "pt-BR" })
      .set("Cookie", sessionCookie);
    expect(slashed.body.date).toBe("2027-01-05");
  });

  it("answers 404 for text it cannot read and 400 without q", async () => {
    const unknown = await request(app).get(`${API}/dates/parse`).query({ q: "someday" }).set("Cookie", sessionCookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("DATE_NOT_RECOGNIZED");

    const empty = await request(app).get(`${API}/dates/parse`).set("Cookie", sessionCookie);
    expect(empty.status).toBe(400);
  });

  it("works with a read-only API token", async () => {
    const primer = await request(app).get(`${API}/api-tokens`).set("Cookie", sessionCookie);
    const csrfCookie = (primer.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("planner_csrf="))!
      .split(";")[0];
    const csrfToken = decodeURIComponent(csrfCookie.split("=")[1]).split(":")[0];
    const minted = await request(app)
      .post(`${API}/api-tokens`)
      .set("Cookie", [sessionCookie, csrfCookie])
      .set("X-XSRF-TOKEN", csrfToken)
      .send({ name: "agent", scopes: ["read"], expiresInDays: 30 });

    const res = await request(app)
      .get(`${API}/dates/parse`)
      .query({ q: "in 3 days" })
      .set("Authorization", `Bearer ${minted.body.rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects anonymous callers", async () => {
    const res = await request(app).get(`${API}/dates/parse`).query({ q: "today" });
    expect(res.status).toBe(401);
  });
});
