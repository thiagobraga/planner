import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { putTaskDocument } from "../../services/documentService.js";
import { buildMcpServer } from "../server.js";

let userId: string;
let taskId: string;
let client: Client;

async function call(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = result.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { text, isError: result.isError === true };
}

async function storedTask() {
  return (await pool.query("SELECT title, description FROM tasks WHERE id = $1", [taskId])).rows[0];
}

describe("MCP update_task notes on tasks with a document (real PostgreSQL + Redis)", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  });

  beforeEach(async () => {
    userId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `mcp-doc-${userId}@example.com`]);
    const collection = await pool.query<{ id: string }>(
      "INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true) RETURNING id",
      [userId],
    );
    const task = await pool.query<{ id: string }>(
      "INSERT INTO tasks (user_id, collection_id, title, description, order_value) VALUES ($1, $2, 'Plan', 'Old notes', 0) RETURNING id",
      [userId, collection.rows[0].id],
    );
    taskId = task.rows[0].id;
    const server = buildMcpServer({ userId, scopes: ["read", "write"], now: () => new Date() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-agent", version: "1.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    try {
      await client?.close();
    } finally {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  });

  it("still replaces notes on a task without a document", async () => {
    const result = await call("update_task", { id: taskId, notes: "New notes" });
    expect(result.isError).toBe(false);
    expect(await storedTask()).toEqual({ title: "Plan", description: "New notes" });
  });

  it("refuses to replace notes once a document exists, leaving the task as it was", async () => {
    await putTaskDocument(taskId, userId, {
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Rich" }] }] },
      baseRevision: 0,
    });

    for (const notes of ["Plain", "", null]) {
      const result = await call("update_task", { id: taskId, title: "Renamed", notes });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/^DOCUMENT_EXISTS: .*revision 1/);
    }
    expect(await storedTask()).toEqual({ title: "Plan", description: "Rich" });

    const renamed = await call("update_task", { id: taskId, title: "Renamed" });
    expect(renamed.isError).toBe(false);
    expect(await storedTask()).toEqual({ title: "Renamed", description: "Rich" });
  });
});
