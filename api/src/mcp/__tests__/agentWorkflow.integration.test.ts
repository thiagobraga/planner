import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { buildMcpServer } from "../server.js";
import { createPersonalToken } from "../../services/apiTokenService.js";
import type { ApiTokenScope } from "../../types/apiToken.js";
import type { RequestActor } from "../../types/activity.js";

const NOW = new Date("2026-10-06T13:00:00Z");
const TZ = "America/Sao_Paulo";

let userId: string;
let workId: string;
let actorA: RequestActor;
let actorB: RequestActor;

async function seedUser(): Promise<void> {
  userId = crypto.randomUUID();
  const inboxId = crypto.randomUUID();
  workId = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `mcp-agent-${userId}@example.com`]);
  await pool.query("INSERT INTO preferences (user_id, time_zone) VALUES ($1, $2)", [userId, TZ]);
  await pool.query(
    "INSERT INTO collections (id, user_id, name, color, is_inbox) VALUES ($1, $2, 'Inbox', '#bababa', true), ($3, $2, 'Work', '#c9483b', false)",
    [inboxId, userId, workId],
  );
  const tokA = await createPersonalToken(userId, { name: "Claude Agent", scopes: ["read", "write"], expiresInDays: 30 });
  const tokB = await createPersonalToken(userId, { name: "Codex Agent", scopes: ["read", "write"], expiresInDays: 30 });
  actorA = { type: "token", credentialId: tokA.token.id, label: tokA.token.name };
  actorB = { type: "token", credentialId: tokB.token.id, label: tokB.token.name };
}

async function connect(scopes: ApiTokenScope[], actor?: RequestActor, now = () => NOW): Promise<Client> {
  const server = buildMcpServer({ userId, scopes, now, actor });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = result.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { text, isError: result.isError === true };
}

function idOf(text: string): string {
  return /id:([0-9a-f-]{36})/.exec(text)![1]!;
}

describe("MCP agent workflow: documents, comments, claims and batch tasks (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(seedUser);

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("reads a plan document, embeds subtasks, rejects stale revisions, and lists descendants in get_task", async () => {
    const writer = await connect(["read", "write"], actorA);
    const reader = await connect(["read"], actorA);

    const planId = idOf(
      (await call(writer, "create_task", { title: "S7 · MCP agent tools", collection: "Work", notes: "Initial goal" })).text,
    );

    const doc0 = await call(reader, "get_task_document", { id: planId });
    expect(doc0.isError).toBe(false);
    expect(doc0.text).toContain("revision:0");
    expect(doc0.text).toContain("Initial goal");

    // Atomically create and embed a subtask at revision 0
    const embedded = await call(writer, "save_task_document", {
      task_id: planId,
      base_revision: 0,
      embed_subtask: { title: "Add claim tool", block_id: "blk-claim" },
    });
    expect(embedded.isError).toBe(false);
    expect(embedded.text).toContain("revision:1");
    const childId = idOf(embedded.text);

    // Stale edit at revision 0 conflicts instead of overwriting
    const stale = await call(writer, "save_task_document", {
      task_id: planId,
      base_revision: 0,
      append_paragraph: "Stale paragraph",
    });
    expect(stale.isError).toBe(true);
    expect(stale.text).toContain("DOCUMENT_CONFLICT");

    // Plain description update_task notes is refused once a document exists
    const plainAttempt = await call(writer, "update_task", { id: planId, notes: "Overwrite attempt" });
    expect(plainAttempt.isError).toBe(true);
    expect(plainAttempt.text).toContain("DOCUMENT_EXISTS");

    // Full get_task shows the document revision, embedded block and descendant
    const detail = await call(reader, "get_task", { id: planId });
    expect(detail.isError).toBe(false);
    expect(detail.text).toContain("S7 · MCP agent tools");
    expect(detail.text).toContain("revision:1");
    expect(detail.text).toContain(`Add claim tool`);
    expect(detail.text).toContain(`id:${childId}`);
  });

  it("creates batch tasks once despite retries and rejects a changed payload with the same idempotency_key", async () => {
    const writer = await connect(["read", "write"], actorA);
    const parentId = idOf((await call(writer, "create_task", { title: "Milestone", collection: "Work" })).text);

    const key = `mcp-batch-${crypto.randomUUID()}`;
    const first = await call(writer, "create_tasks_batch", {
      idempotency_key: key,
      parent: parentId,
      tasks: [
        { title: "Subtask A" },
        { title: "Subtask B", priority: 1 },
      ],
    });
    expect(first.isError).toBe(false);
    expect(first.text).toContain("Created 2 tasks");

    const retry = await call(writer, "create_tasks_batch", {
      idempotency_key: key,
      parent: parentId,
      tasks: [
        { title: "Subtask A" },
        { title: "Subtask B", priority: 1 },
      ],
    });
    expect(retry.isError).toBe(false);
    expect(retry.text).toContain("Deduplicated 2 tasks");

    const conflict = await call(writer, "create_tasks_batch", {
      idempotency_key: key,
      parent: parentId,
      tasks: [{ title: "Different payload" }],
    });
    expect(conflict.isError).toBe(true);
    expect(conflict.text).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("coordinates parallel agents with atomic claims, posts comments, and attributes activity to the acting token", async () => {
    const clientA = await connect(["read", "write"], actorA);
    const clientB = await connect(["read", "write"], actorB);

    const taskId = idOf((await call(clientA, "create_task", { title: "Implement slice", collection: "Work" })).text);

    // Two concurrent claimants yield one winner
    const [claimA, claimB] = await Promise.all([
      call(clientA, "claim_task", { id: taskId, ttl_minutes: 15 }),
      call(clientB, "claim_task", { id: taskId, ttl_minutes: 15 }),
    ]);
    const winners = [claimA, claimB].filter((r) => !r.isError);
    const losers = [claimA, claimB].filter((r) => r.isError);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].text).toContain("TASK_CLAIMED");

    const winningClient = !claimA.isError ? clientA : clientB;
    const winningActor = !claimA.isError ? actorA : actorB;

    // Post progress comment and read it back
    const commented = await call(winningClient, "add_comment", {
      task_id: taskId,
      body: "PR opened and verified against CI.",
    });
    expect(commented.isError).toBe(false);

    const comments = await call(winningClient, "list_task_comments", { task_id: taskId });
    expect(comments.isError).toBe(false);
    expect(comments.text).toContain("PR opened and verified against CI.");

    // Release claim
    const released = await call(winningClient, "release_task", { id: taskId });
    expect(released.isError).toBe(false);
    expect(released.text).toContain("Released");

    // Activity feed shows actor attribution
    const activity = await call(winningClient, "list_activity", { collection: "Work" });
    expect(activity.isError).toBe(false);
    expect(activity.text).toContain(winningActor.label);
    expect(activity.text).toContain("comment_created");
    expect(activity.text).toContain("task_claimed");
  });
});
