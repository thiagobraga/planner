import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import pool from "../../db/pool.js";
import { connectRedis, redisClient, redisPubClient, redisSubClient } from "../../db/redis.js";
import { buildMcpServer } from "../server.js";
import type { ApiTokenScope } from "../../types/apiToken.js";

// Tuesday 2026-10-06, 10:00 in Sao Paulo
const NOW = new Date("2026-10-06T13:00:00Z");
const TZ = "America/Sao_Paulo";

let userId: string;
let inboxId: string;
let workId: string;

async function seedUser(): Promise<void> {
  userId = crypto.randomUUID();
  inboxId = crypto.randomUUID();
  workId = crypto.randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `mcp-${userId}@example.com`]);
  await pool.query("INSERT INTO preferences (user_id, time_zone) VALUES ($1, $2)", [userId, TZ]);
  await pool.query(
    "INSERT INTO collections (id, user_id, name, color, is_inbox) VALUES ($1, $2, 'Inbox', '#bababa', true), ($3, $2, 'Work', '#c9483b', false)",
    [inboxId, userId, workId],
  );
}

async function connect(scopes: ApiTokenScope[], forUser = userId): Promise<Client> {
  const server = buildMcpServer({ userId: forUser, scopes, now: () => NOW });
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

describe("Planner MCP server (real PostgreSQL + Redis)", () => {
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

  it("lists only read tools for a read-only token and all tools for a write token", async () => {
    const reader = await connect(["read"]);
    const writer = await connect(["read", "write"]);

    const readNames = (await reader.listTools()).tools.map((t) => t.name).sort();
    const writeNames = (await writer.listTools()).tools.map((t) => t.name).sort();

    expect(readNames).toEqual([
      "filter_tasks", "get_collection", "get_inbox", "get_today", "get_upcoming",
      "list_collections", "list_habits", "list_labels", "search",
    ]);
    expect(writeNames).toEqual(
      [...readNames, "complete_task", "create_task", "delete_task", "log_habit", "move_task", "reopen_task", "reschedule_tasks", "update_task"].sort(),
    );

    const deleteTool = (await writer.listTools()).tools.find((t) => t.name === "delete_task")!;
    expect(deleteTool.annotations?.destructiveHint).toBe(true);
  });

  it("refuses write tools a read-only token was never given", async () => {
    const reader = await connect(["read"]);

    const result = await call(reader, "create_task", { title: "sneaky" });

    expect(result.isError).toBe(true);
    const count = await pool.query("SELECT COUNT(*)::int AS n FROM tasks WHERE user_id = $1", [userId]);
    expect(count.rows[0].n).toBe(0);
  });

  it("creates a task with a natural-language date in the user's timezone and publishes a sync event", async () => {
    const writer = await connect(["read", "write"]);
    const listener = redisClient.duplicate();
    await listener.connect();
    const events: string[] = [];
    await listener.subscribe("sync", (message) => events.push(message));

    const created = await call(writer, "create_task", { title: "Call the dentist", due: "tomorrow 15:00", collection: "work", priority: 1 });

    expect(created.isError).toBe(false);
    expect(created.text).toMatch(/^Created - \[ \] Call the dentist · due 2026-10-07 15:00 · p1 · #Work · id:/);
    const row = await pool.query("SELECT collection_id, to_char(due_date, 'YYYY-MM-DD') AS due FROM tasks WHERE id = $1", [idOf(created.text)]);
    expect(row.rows[0]).toEqual({ collection_id: workId, due: "2026-10-07" });

    await expect.poll(() => events.some((e) => e.includes(idOf(created.text)))).toBe(true);
    await listener.quit();
  });

  it("drives a task through today, complete, reopen, reschedule, move and delete", async () => {
    const client = await connect(["read", "write"]);
    const id = idOf((await call(client, "create_task", { title: "Write report", due: "today" })).text);

    expect((await call(client, "get_today")).text).toContain(`Write report · due 2026-10-06 · #Inbox · id:${id}`);
    expect((await call(client, "get_inbox")).text).toContain("Write report");

    expect((await call(client, "complete_task", { id })).text).toMatch(/^Completed - \[x\] Write report/);
    expect((await call(client, "reopen_task", { id })).text).toMatch(/^Reopened - \[ \] Write report/);

    const rescheduled = await call(client, "reschedule_tasks", { ids: [id, crypto.randomUUID()], due: "2026-10-20" });
    expect(rescheduled.text).toMatch(/^Rescheduled 1 of 2 to 2026-10-20\./);
    expect((await call(client, "get_upcoming", { days: 30 })).text).toContain("2026-10-20:\n- [ ] Write report");

    expect((await call(client, "move_task", { id, collection: "Work" })).text).toContain("#Work");
    expect((await call(client, "get_collection", { collection: "Work" })).text).toContain("Write report");

    expect((await call(client, "delete_task", { id })).text).toBe(`Deleted task id:${id}.`);
    expect((await call(client, "search", { query: "report" })).text).toBe('No results for "report".');
  });

  it("updates fields, clears the due date and resolves labels by name", async () => {
    const client = await connect(["read", "write"]);
    const labelId = crypto.randomUUID();
    await pool.query("INSERT INTO labels (id, user_id, name, color) VALUES ($1, $2, 'urgent', '#c9483b')", [labelId, userId]);
    const id = idOf((await call(client, "create_task", { title: "Draft", due: "today" })).text);

    const updated = await call(client, "update_task", { id, title: "Final", due: null, labels: ["@urgent"], priority: 2 });

    expect(updated.text).toBe(`Updated - [ ] Final · p2 · @urgent · #Inbox · id:${id}`);
    expect((await call(client, "filter_tasks", { query: "@urgent & p2 & no date" })).text).toContain("Final");
  });

  it("turns bad input into readable tool errors", async () => {
    const client = await connect(["read", "write"]);

    const badCollection = await call(client, "create_task", { title: "x", collection: "Nowhere" });
    expect(badCollection).toEqual({ isError: true, text: expect.stringContaining('No collection named "Nowhere". Available: Inbox') });

    const badDate = await call(client, "create_task", { title: "x", due: "someday maybe" });
    expect(badDate.isError).toBe(true);
    expect(badDate.text).toContain('Could not understand the date "someday maybe"');

    const badId = await call(client, "complete_task", { id: "Buy milk" });
    expect(badId.text).toContain("is not a valid task id");

    const badFilter = await call(client, "filter_tasks", { query: "& &" });
    expect(badFilter.isError).toBe(true);
    expect(badFilter.text).toMatch(/^Invalid filter:/);
  });

  it("cannot see or touch another user's tasks", async () => {
    const owner = await connect(["read", "write"]);
    const id = idOf((await call(owner, "create_task", { title: "Private" })).text);

    const otherUser = userId;
    await seedUser();
    const intruder = await connect(["read", "write"]);
    try {
      const result = await call(intruder, "delete_task", { id });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/^NOT_FOUND/);
      expect((await call(intruder, "search", { query: "Private" })).text).toBe('No results for "Private".');
    } finally {
      await pool.query("DELETE FROM users WHERE id = $1", [otherUser]);
    }
  });

  it("logs habits by name and reports streaks", async () => {
    const client = await connect(["read", "write"]);
    const habitId = crypto.randomUUID();
    await pool.query("INSERT INTO habits (id, user_id, name) VALUES ($1, $2, 'Read')", [habitId, userId]);
    await pool.query("INSERT INTO habit_completions (habit_id, completed_date) VALUES ($1, '2026-10-05'), ($1, '2026-10-04')", [habitId]);

    expect((await call(client, "list_habits")).text).toBe(`- [ ] Read · 2/7 this week · streak 2 · id:${habitId}`);
    expect((await call(client, "log_habit", { habit: "read" })).text).toBe("Read: marked done for 2026-10-06.");
    expect((await call(client, "list_habits")).text).toBe(`- [x] Read · 3/7 this week · streak 3 · id:${habitId}`);
  });

  it("lists collections and labels with ids", async () => {
    const client = await connect(["read"]);

    const collections = (await call(client, "list_collections")).text;
    expect(collections).toContain(`- Inbox (inbox) · id:${inboxId}`);
    expect(collections).toContain(`- Work · id:${workId}`);
    expect((await call(client, "list_labels")).text).toBe("No labels.");
  });
});
