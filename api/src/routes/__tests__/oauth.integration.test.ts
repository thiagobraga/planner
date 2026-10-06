import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { createSession, buildCookieName } from "../../services/sessionService.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import app from "../../index.js";

// Test config: CORS_ORIGIN=http://localhost:5173, so that is the public base URL.
const BASE = "http://localhost:5173";
const MCP_URL = `${BASE}/api/v1/mcp`;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const ACCEPT = "application/json, text/event-stream";

let userId: string;
let sessionCookie: string;
const clientIds: string[] = [];

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClient(redirectUris = [REDIRECT]) {
  const res = await request(app)
    .post("/api/oauth/register")
    .send({
      client_name: "Claude",
      client_uri: "https://claude.ai",
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  if (res.status === 201) clientIds.push(res.body.client_id);
  return res;
}

async function sessionWrite(path: string, body: object) {
  const primer = await request(app).get(`/api/v1/oauth/grants`).set("Cookie", sessionCookie);
  const csrf = (primer.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("planner_csrf="))!.split(";")[0];
  return request(app)
    .post(path)
    .set("Cookie", [sessionCookie, csrf])
    .set("X-XSRF-TOKEN", decodeURIComponent(csrf.split("=")[1]).split(":")[0])
    .send(body);
}

/** Runs authorize -> consent -> code, returning what the client's callback would receive. */
async function authorize(clientId: string, decision: "read" | "write" | "deny", scope = "read write") {
  const { verifier, challenge } = pkce();
  const auth = await request(app).get("/api/oauth/authorize").query({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "xyz",
    scope,
    resource: MCP_URL,
  });
  expect(auth.status).toBe(302);
  const consentUrl = new URL(auth.headers.location as string);
  expect(`${consentUrl.origin}${consentUrl.pathname}`).toBe(`${BASE}/oauth/consent`);
  const requestId = consentUrl.searchParams.get("request")!;

  const decided = await sessionWrite(`/api/v1/oauth/requests/${requestId}/decision`, { decision });
  expect(decided.status).toBe(200);
  const callback = new URL(decided.body.redirectUrl);
  return { callback, verifier, requestId };
}

async function exchange(clientId: string, code: string, verifier: string) {
  return request(app).post("/api/oauth/token").type("form").send({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT,
    resource: MCP_URL,
  });
}

async function connectedTokens(decision: "read" | "write" = "write") {
  const clientId = (await registerClient()).body.client_id as string;
  const { callback, verifier } = await authorize(clientId, decision);
  const tokens = await exchange(clientId, callback.searchParams.get("code")!, verifier);
  expect(tokens.status).toBe(200);
  return { clientId, tokens: tokens.body as { access_token: string; refresh_token: string; scope: string } };
}

function mcp(accessToken: string, method: string, params: object = {}) {
  return request(app)
    .post("/api/v1/mcp")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Accept", ACCEPT)
    .send({ jsonrpc: "2.0", id: 1, method, params });
}

describe("OAuth for hosted MCP clients (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM oauth_clients WHERE client_id = ANY($1::text[])", [clientIds]);
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `oauth-${userId}@example.com`]);
    await pool.query("INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true)", [userId]);
    sessionCookie = `${buildCookieName()}=${await createSession(userId)}`;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("advertises discovery metadata and challenges MCP calls toward it", async () => {
    const prm = await request(app).get("/.well-known/oauth-protected-resource/api/v1/mcp");
    expect(prm.status).toBe(200);
    expect(prm.body).toMatchObject({ resource: MCP_URL, authorization_servers: [BASE], scopes_supported: ["read", "write"] });

    const as = await request(app).get("/.well-known/oauth-authorization-server");
    expect(as.body).toMatchObject({
      issuer: BASE,
      authorization_endpoint: `${BASE}/api/oauth/authorize`,
      token_endpoint: `${BASE}/api/oauth/token`,
      registration_endpoint: `${BASE}/api/oauth/register`,
      code_challenge_methods_supported: ["S256"],
    });

    const unauthenticated = await request(app).post("/api/v1/mcp").set("Accept", ACCEPT).send({});
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers["www-authenticate"]).toContain(
      `resource_metadata="${BASE}/.well-known/oauth-protected-resource/api/v1/mcp"`,
    );
  });

  it("only registers clients with https or loopback redirect URIs", async () => {
    expect((await registerClient(["http://localhost:6274/oauth/callback"])).status).toBe(201);
    const bad = await registerClient(["http://evil.example.com/callback"]);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_client_metadata");
  });

  it("runs the full flow: consent, code exchange, MCP tools, attributed activity", async () => {
    const { tokens } = await connectedTokens("write");
    expect(tokens.access_token).toMatch(/^plnr_oat_/);
    expect(tokens.scope).toBe("read write");

    const tools = await mcp(tokens.access_token, "tools/list");
    expect(tools.status).toBe(200);
    expect(tools.body.result.tools.map((t: { name: string }) => t.name)).toContain("create_task");

    const created = await mcp(tokens.access_token, "tools/call", { name: "create_task", arguments: { title: "Via OAuth" } });
    expect(created.body.result.content[0].text).toMatch(/^Created - \[ \] Via OAuth/);
    const activity = await pool.query(
      "SELECT actor_type, actor_label, oauth_grant_id IS NOT NULL AS has_grant FROM activity_events WHERE user_id = $1",
      [userId],
    );
    expect(activity.rows).toEqual([{ actor_type: "oauth", actor_label: "Claude", has_grant: true }]);
  });

  it("shows the consent page what is being asked, and keeps a read choice read-only", async () => {
    const clientId = (await registerClient()).body.client_id as string;
    const { challenge } = pkce();
    const auth = await request(app).get("/api/oauth/authorize").query({
      response_type: "code", client_id: clientId, redirect_uri: REDIRECT,
      code_challenge: challenge, code_challenge_method: "S256", scope: "read write",
    });
    const requestId = new URL(auth.headers.location as string).searchParams.get("request");

    const pending = await request(app).get(`/api/v1/oauth/requests/${requestId}`).set("Cookie", sessionCookie);
    expect(pending.body).toEqual({
      id: requestId, clientName: "Claude", clientUri: "https://claude.ai", redirectHost: "claude.ai", scopes: ["read", "write"],
    });

    const { tokens } = await connectedTokens("read");
    expect(tokens.scope).toBe("read");
    const names = (await mcp(tokens.access_token, "tools/list")).body.result.tools.map((t: { name: string }) => t.name);
    expect(names).not.toContain("create_task");
  });

  it("sends the user back with access_denied when they cancel", async () => {
    const clientId = (await registerClient()).body.client_id as string;
    const { callback } = await authorize(clientId, "deny");

    expect(callback.searchParams.get("error")).toBe("access_denied");
    expect(callback.searchParams.get("state")).toBe("xyz");
    expect(callback.searchParams.get("code")).toBeNull();
  });

  it("rejects a wrong PKCE verifier and a replayed code, revoking on replay", async () => {
    const clientId = (await registerClient()).body.client_id as string;
    const { callback, verifier } = await authorize(clientId, "write");
    const code = callback.searchParams.get("code")!;

    expect((await exchange(clientId, code, pkce().verifier)).body.error).toBe("invalid_grant");

    const first = await exchange(clientId, code, verifier);
    expect(first.status).toBe(200);
    const replay = await exchange(clientId, code, verifier);
    expect(replay.body.error).toBe("invalid_grant");
    expect((await mcp(first.body.access_token, "tools/list")).status).toBe(401);
  });

  it("rotates refresh tokens and treats reuse of an old one as theft", async () => {
    const { clientId, tokens } = await connectedTokens();
    const refresh = () =>
      request(app).post("/api/oauth/token").type("form").send({ grant_type: "refresh_token", client_id: clientId, refresh_token: tokens.refresh_token });

    const rotated = await refresh();
    expect(rotated.status).toBe(200);
    expect(rotated.body.refresh_token).not.toBe(tokens.refresh_token);
    expect((await mcp(rotated.body.access_token, "tools/list")).status).toBe(200);

    const reused = await refresh();
    expect(reused.body.error).toBe("invalid_grant");
    expect((await mcp(rotated.body.access_token, "tools/list")).status).toBe(401);
  });

  it("keeps OAuth tokens on the MCP endpoint only and off session-only routes", async () => {
    const { tokens } = await connectedTokens();

    const rest = await request(app).get("/api/v1/views/inbox").set("Authorization", `Bearer ${tokens.access_token}`);
    expect(rest.status).toBe(403);
    expect(rest.body.error.code).toBe("TOKEN_NOT_ALLOWED");

    const { rawToken } = await createPersonalToken(userId, { name: "t", scopes: ["read"], expiresInDays: 30 });
    const viaToken = await request(app).get("/api/v1/oauth/grants").set("Authorization", `Bearer ${rawToken}`);
    expect(viaToken.status).toBe(403);
    expect(viaToken.body.error.code).toBe("SESSION_REQUIRED");
  });

  it("lists connected apps and cuts one off on disconnect", async () => {
    const { tokens } = await connectedTokens();

    const apps = await request(app).get("/api/v1/oauth/grants").set("Cookie", sessionCookie);
    expect(apps.body).toEqual([
      expect.objectContaining({ clientName: "Claude", clientUri: "https://claude.ai", scopes: ["read", "write"] }),
    ]);

    const primer = await request(app).get("/api/v1/oauth/grants").set("Cookie", sessionCookie);
    const csrf = (primer.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("planner_csrf="))!.split(";")[0];
    const disconnect = await request(app)
      .delete(`/api/v1/oauth/grants/${apps.body[0].id}`)
      .set("Cookie", [sessionCookie, csrf])
      .set("X-XSRF-TOKEN", decodeURIComponent(csrf.split("=")[1]).split(":")[0])
      .set("Content-Type", "application/json");
    expect(disconnect.status).toBe(200);
    expect((await mcp(tokens.access_token, "tools/list")).status).toBe(401);
  });

  it("refuses a disabled user's tokens", async () => {
    const { tokens } = await connectedTokens();
    await pool.query("UPDATE users SET disabled_at = NOW() WHERE id = $1", [userId]);

    expect((await mcp(tokens.access_token, "tools/list")).status).toBe(401);
  });
});
