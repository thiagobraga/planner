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
      "filter_tasks", "get_collection", "get_inbox", "get_task", "get_task_document", "get_today", "get_upcoming",
      "list_activity", "list_collections", "list_habits", "list_labels", "list_statuses", "list_task_comments", "search",
    ]);
    expect(writeNames).toEqual(
      [
        ...readNames,
        "add_comment", "claim_task", "complete_task", "create_task", "create_tasks_batch",
        "delete_task", "import_markdown", "log_habit", "move_task", "release_task", "reopen_task",
        "reschedule_tasks", "save_task_document", "undo_import", "update_task",
      ].sort(),
    );

    const deleteTool = (await writer.listTools()).tools.find((t) => t.name === "delete_task")!;
    expect(deleteTool.annotations?.destructiveHint).toBe(true);
  });

  it("creates, moves and promotes a child with its subtree intact", async () => {
    const client = await connect(["read", "write"]);
    const parent = idOf((await call(client, "create_task", { title: "Parent", collection: "Work" })).text);
    const child = idOf((await call(client, "create_task", { title: "Child", parent })).text);
    const grandchild = idOf((await call(client, "create_task", { title: "Grandchild", parent: child })).text);
    const destination = idOf((await call(client, "create_task", { title: "Inbox parent" })).text);

    const taskRow = async (id: string) =>
      (await pool.query("SELECT collection_id, parent_task_id, depth FROM tasks WHERE id = $1", [id])).rows[0];

    expect(await taskRow(child)).toEqual({ collection_id: workId, parent_task_id: parent, depth: 1 });
    expect((await call(client, "move_task", { id: child, parent: grandchild })).isError).toBe(true);
    expect((await call(client, "move_task", { id: child, parent: destination })).text).toContain("#Inbox");
    expect(await taskRow(child)).toEqual({ collection_id: inboxId, parent_task_id: destination, depth: 1 });
    expect(await taskRow(grandchild)).toEqual({ collection_id: inboxId, parent_task_id: child, depth: 2 });

    expect((await call(client, "move_task", { id: child, parent: null })).isError).toBe(false);
    expect(await taskRow(child)).toEqual({ collection_id: inboxId, parent_task_id: null, depth: 0 });
    expect(await taskRow(grandchild)).toEqual({ collection_id: inboxId, parent_task_id: child, depth: 1 });
  });

  it("lists collection statuses with read scope and updates a child's status by name or id", async () => {
    const reader = await connect(["read"]);
    const writer = await connect(["read", "write"]);
    const status = crypto.randomUUID();
    await pool.query("INSERT INTO task_statuses (id, collection_id, name, order_value) VALUES ($1, $2, 'Done', 0)", [status, workId]);
    await pool.query("UPDATE collections SET completion_status_id = $1 WHERE id = $2", [status, workId]);

    const listing = await call(reader, "list_statuses", { collection: "Work" });
    expect(listing.text).toContain(`Done · id:${status}`);
    const parent = idOf((await call(writer, "create_task", { title: "Parent", collection: "Work" })).text);
    const id = idOf((await call(writer, "create_task", { title: "Child", parent })).text);
    expect((await call(reader, "update_task", { id, status })).isError).toBe(true);
    expect((await call(writer, "update_task", { id, title: "Edited", status: "Done" })).isError).toBe(true);
    expect((await call(writer, "update_task", { id, status: "Done" })).text).toContain("[x] Child");

    const assigned = await pool.query("SELECT status_id, is_completed, parent_task_id FROM tasks WHERE id = $1", [id]);
    expect(assigned.rows[0]).toEqual({ status_id: status, is_completed: true, parent_task_id: parent });
    const activity = await pool.query(
      "SELECT after_data FROM activity_events WHERE entity_id = $1 AND event_type = 'task_updated'",
      [id],
    );
    expect(activity.rows).toEqual([{ after_data: { title: "Child", fields: ["statusId"] } }]);
    const doing = crypto.randomUUID();
    await pool.query("INSERT INTO task_statuses (id, collection_id, name, order_value) VALUES ($1, $2, 'Doing', 1)", [doing, workId]);
    expect((await call(writer, "update_task", { id, status: doing })).text).toContain("[ ] Child");
    expect((await call(writer, "update_task", { id, status: null })).isError).toBe(false);
    const cleared = await pool.query("SELECT status_id FROM tasks WHERE id = $1", [id]);
    expect(cleared.rows[0].status_id).toBeNull();
    expect((await call(writer, "update_task", { id, status })).isError).toBe(false);

    const inboxTask = idOf((await call(writer, "create_task", { title: "Inbox task" })).text);
    expect((await call(writer, "update_task", { id: inboxTask, status })).isError).toBe(true);
  });

  it("keeps a parent change committed while a status update waits for the task lock", async () => {
    const writer = await connect(["read", "write"]);
    const oldParent = idOf((await call(writer, "create_task", { title: "Old parent", collection: "Work" })).text);
    const newParent = idOf((await call(writer, "create_task", { title: "New parent", collection: "Work" })).text);
    const id = idOf((await call(writer, "create_task", { title: "Child", parent: oldParent })).text);
    const status = crypto.randomUUID();
    await pool.query("INSERT INTO task_statuses (id, collection_id, name, order_value) VALUES ($1, $2, 'Doing', 0)", [status, workId]);

    const client = await pool.connect();
    let change: ReturnType<typeof call> | undefined;
    try {
      await client.query("BEGIN");
      await client.query("UPDATE tasks SET parent_task_id = $1 WHERE id = $2", [newParent, id]);
      const { rows: [{ pid }] } = await client.query("SELECT pg_backend_pid() AS pid");
      change = call(writer, "update_task", { id, status });
      await expect.poll(async () => {
        const { rows } = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS waiting",
          [pid],
        );
        return rows[0].waiting;
      }).toBe(true);
      await client.query("COMMIT");
    } finally {
      await client.query("ROLLBACK");
      client.release();
      if (change) expect((await change).isError).toBe(false);
    }

    const { rows } = await pool.query("SELECT parent_task_id, status_id FROM tasks WHERE id = $1", [id]);
    expect(rows[0]).toEqual({ parent_task_id: newParent, status_id: status });
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

  it("creates a repeating task counted from completion with an end date", async () => {
    const client = await connect(["read", "write"]);
    const created = await call(client, "create_task", {
      title: "Long run",
      due: "every saturday",
      from_completion: true,
      until: "2026-12-31",
    });

    expect(created.text).toContain("recurring from completion until 2026-12-31");
    const row = await pool.query("SELECT recurrence_rule FROM tasks WHERE id = $1", [idOf(created.text)]);
    expect(row.rows[0].recurrence_rule).toEqual({
      type: "weekly",
      interval: 1,
      weekdays: [6],
      fromCompletion: true,
      until: "2026-12-31",
    });
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

  it("get_today splits overdue from today; get_upcoming spans N days and skips empty and completed ones", async () => {
    const client = await connect(["read", "write"]);
    const old = idOf((await call(client, "create_task", { title: "Old", due: "2026-10-01" })).text);
    const today = idOf((await call(client, "create_task", { title: "Now", due: "today" })).text);
    const later = idOf((await call(client, "create_task", { title: "Later", due: "2026-10-08" })).text);
    const done = idOf((await call(client, "create_task", { title: "Finished", due: "2026-10-08" })).text);
    await call(client, "complete_task", { id: done });

    const todayText = (await call(client, "get_today")).text;
    expect(todayText).toContain("Today is 2026-10-06.");
    expect(todayText).toContain(`Overdue (1):\n- [ ] Old · due 2026-10-01 · #Inbox · id:${old}`);
    expect(todayText).toContain(`Due today (1):\n- [ ] Now · due 2026-10-06 · #Inbox · id:${today}`);
    expect(todayText).not.toContain("Later");

    expect((await call(client, "get_upcoming", { days: 1 })).text).toBe(
      `2026-10-06:\n- [ ] Now · due 2026-10-06 · #Inbox · id:${today}`,
    );
    const week = (await call(client, "get_upcoming", { days: 7 })).text;
    expect(week).toContain(`2026-10-08:\n- [ ] Later · due 2026-10-08 · #Inbox · id:${later}`);
    expect(week).not.toContain("Finished");
    expect(week).not.toContain("Old");
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

    const notRecurring = await call(client, "create_task", { title: "x", due: "tomorrow", from_completion: true });
    expect(notRecurring.isError).toBe(true);
    expect(notRecurring.text).toContain("repeating due");

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
