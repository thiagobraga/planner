import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createSession, buildCookieName } from "../../services/sessionService.js";
import { createApiToken } from "../../services/apiTokenService.js";
import app from "../../index.js";

const MCP = "/api/v1/mcp";
// Streamable HTTP clients must accept both; the server answers with plain JSON.
const ACCEPT = "application/json, text/event-stream";

let userId: string;

function rpc(method: string, params: object = {}, id = 1) {
  return { jsonrpc: "2.0", id, method, params };
}

const INITIALIZE = rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "supertest", version: "1.0.0" },
});

async function bearer(scopes: string[]): Promise<string> {
  const { rawToken } = await createApiToken(userId, { name: "mcp", scopes, expiresInDays: 30 });
  return `Bearer ${rawToken}`;
}

describe("POST /api/v1/mcp (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `mcp-route-${userId}@example.com`]);
    await pool.query("INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true)", [userId]);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("initializes and lists tools over HTTP with a bearer token", async () => {
    const auth = await bearer(["read"]);

    const init = await request(app).post(MCP).set("Authorization", auth).set("Accept", ACCEPT).send(INITIALIZE);
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe("planner");
    expect(init.body.result.instructions).toContain("collections");

    const list = await request(app).post(MCP).set("Authorization", auth).set("Accept", ACCEPT).send(rpc("tools/list", {}, 2));
    expect(list.status).toBe(200);
    expect(list.body.result.tools.map((t: { name: string }) => t.name)).toContain("get_today");
  });

  it("lets a read-only token call read tools even though every call is a POST", async () => {
    const auth = await bearer(["read"]);

    const res = await request(app)
      .post(MCP)
      .set("Authorization", auth)
      .set("Accept", ACCEPT)
      .send(rpc("tools/call", { name: "get_inbox", arguments: {} }));

    expect(res.status).toBe(200);
    expect(res.body.result.content[0].text).toBe("Inbox is empty.");
  });

  it("creates a task through tools/call with a write token", async () => {
    const auth = await bearer(["read", "write"]);

    const res = await request(app)
      .post(MCP)
      .set("Authorization", auth)
      .set("Accept", ACCEPT)
      .send(rpc("tools/call", { name: "create_task", arguments: { title: "From HTTP" } }));

    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBeFalsy();
    const rows = await pool.query("SELECT title FROM tasks WHERE user_id = $1", [userId]);
    expect(rows.rows).toEqual([{ title: "From HTTP" }]);
  });

  it("challenges unauthenticated callers", async () => {
    const res = await request(app).post(MCP).set("Accept", ACCEPT).send(INITIALIZE);

    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="planner"');
  });

  it("refuses browser sessions even with a valid CSRF pair", async () => {
    const session = `${buildCookieName()}=${await createSession(userId)}`;
    const primer = await request(app).get("/api/v1/views/inbox").set("Cookie", session);
    const csrfCookie = (primer.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("planner_csrf="))!
      .split(";")[0];
    const csrfToken = decodeURIComponent(csrfCookie.split("=")[1]).split(":")[0];

    const res = await request(app)
      .post(MCP)
      .set("Cookie", [session, csrfCookie])
      .set("X-XSRF-TOKEN", csrfToken)
      .set("Accept", ACCEPT)
      .send(INITIALIZE);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("TOKEN_REQUIRED");
  });

  it("answers GET with 405", async () => {
    const res = await request(app).get(MCP).set("Authorization", await bearer(["read"]));

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });
});
