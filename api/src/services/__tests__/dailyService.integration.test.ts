import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { AppError } from "../../utils/AppError.js";
import { getDailyView } from "../dailyService.js";

const NOON_UTC = new Date("2026-10-07T12:00:00Z");

let userId: string;
let collectionId: string;

async function addTask(title: string, dueDate: string | null, overrides: { completed?: boolean; type?: string; orderValue?: number; collection?: string } = {}) {
  const result = await pool.query(
    `INSERT INTO tasks (user_id, collection_id, title, due_date, is_completed, type, order_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [userId, overrides.collection ?? collectionId, title, dueDate, overrides.completed ?? false, overrides.type ?? "task", overrides.orderValue ?? 0],
  );
  return result.rows[0].id as string;
}

async function setPrefs(values: { timeZone?: string; hideCompleted?: boolean; showNotes?: boolean }) {
  await pool.query(
    `INSERT INTO preferences (user_id, time_zone, hide_completed_tasks, show_notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET time_zone = $2, hide_completed_tasks = $3, show_notes = $4`,
    [userId, values.timeZone ?? "UTC", values.hideCompleted ?? false, values.showNotes ?? true],
  );
}

function titles(tasks: { title: string }[]) {
  return tasks.map((t) => t.title);
}

describe("getDailyView (real PostgreSQL)", () => {
  beforeEach(async () => {
    userId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `daily-${userId}@example.com`]);
    const col = await pool.query("INSERT INTO collections (user_id, name, color, is_inbox) VALUES ($1, 'Inbox', '#bababa', true) RETURNING id", [userId]);
    collectionId = col.rows[0].id;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("returns one entry per day of a 1-day range, with today in the user's date", async () => {
    await addTask("today", "2026-10-07");
    await addTask("tomorrow", "2026-10-08");

    const view = await getDailyView(userId, "2026-10-07", "2026-10-07", NOON_UTC);

    expect(view.from).toBe("2026-10-07");
    expect(view.to).toBe("2026-10-07");
    expect(view.today).toBe("2026-10-07");
    expect(view.days).toHaveLength(1);
    expect(view.days[0].date).toBe("2026-10-07");
    expect(titles(view.days[0].tasks)).toEqual(["today"]);
  });

  it("returns every day of a 7-day range, empty days included", async () => {
    await addTask("mon", "2026-10-05");
    await addTask("wed", "2026-10-07");
    await addTask("outside", "2026-10-12");

    const view = await getDailyView(userId, "2026-10-05", "2026-10-11", NOON_UTC);

    expect(view.days.map((d) => d.date)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
    expect(view.days.map((d) => d.tasks.length)).toEqual([1, 0, 1, 0, 0, 0, 0]);
  });

  it("lists overdue relative to today whatever the requested range", async () => {
    await addTask("old", "2026-10-01");
    await addTask("yesterday", "2026-10-06");
    await addTask("today", "2026-10-07");
    await addTask("future", "2026-10-20");

    const future = await getDailyView(userId, "2026-10-19", "2026-10-25", NOON_UTC);

    expect(titles(future.overdue)).toEqual(["old", "yesterday"]);
    expect(future.days.flatMap((d) => titles(d.tasks))).toEqual(["future"]);
  });

  it("keeps past days of the range populated while they also count as overdue", async () => {
    await addTask("monday", "2026-10-05");

    const view = await getDailyView(userId, "2026-10-05", "2026-10-11", NOON_UTC);

    expect(titles(view.overdue)).toEqual(["monday"]);
    expect(titles(view.days[0].tasks)).toEqual(["monday"]);
  });

  it("hides completed tasks everywhere when hideCompletedTasks is on", async () => {
    await setPrefs({ hideCompleted: true });
    await addTask("done overdue", "2026-10-01", { completed: true });
    await addTask("done today", "2026-10-07", { completed: true });
    await addTask("open today", "2026-10-07");

    const view = await getDailyView(userId, "2026-10-07", "2026-10-08", NOON_UTC);

    expect(view.overdue).toEqual([]);
    expect(titles(view.days[0].tasks)).toEqual(["open today"]);
  });

  it("keeps completed tasks when hideCompletedTasks is off", async () => {
    await addTask("done today", "2026-10-07", { completed: true });

    const view = await getDailyView(userId, "2026-10-07", "2026-10-07", NOON_UTC);

    expect(titles(view.days[0].tasks)).toEqual(["done today"]);
  });

  it("drops notes when showNotes is off, on every day", async () => {
    await setPrefs({ showNotes: false });
    await addTask("note today", "2026-10-07", { type: "note" });
    await addTask("note tomorrow", "2026-10-08", { type: "note" });
    await addTask("task tomorrow", "2026-10-08");

    const view = await getDailyView(userId, "2026-10-07", "2026-10-08", NOON_UTC);

    expect(view.days[0].tasks).toEqual([]);
    expect(titles(view.days[1].tasks)).toEqual(["task tomorrow"]);
  });

  it("keeps notes when showNotes is on", async () => {
    await addTask("note", "2026-10-07", { type: "note" });

    const view = await getDailyView(userId, "2026-10-07", "2026-10-07", NOON_UTC);

    expect(titles(view.days[0].tasks)).toEqual(["note"]);
  });

  it("leaves archived collections out", async () => {
    const archived = await pool.query(
      "INSERT INTO collections (user_id, name, color, is_archived) VALUES ($1, 'Old', '#bababa', true) RETURNING id",
      [userId],
    );
    await addTask("hidden", "2026-10-07", { collection: archived.rows[0].id });
    await addTask("hidden overdue", "2026-10-01", { collection: archived.rows[0].id });
    await addTask("shown", "2026-10-07");

    const view = await getDailyView(userId, "2026-10-07", "2026-10-07", NOON_UTC);

    expect(view.overdue).toEqual([]);
    expect(titles(view.days[0].tasks)).toEqual(["shown"]);
  });

  it("orders a day by task_order, falling back to collection order", async () => {
    const a = await addTask("a", "2026-10-07", { orderValue: 10 });
    const b = await addTask("b", "2026-10-07", { orderValue: 20 });
    await addTask("c", "2026-10-07", { orderValue: 5 });
    // b dragged first, a second; c was never dragged so it goes last.
    await pool.query(
      `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
       VALUES ($1, $2, 'day', '2026-10-07', 1), ($1, $3, 'day', '2026-10-07', 2)`,
      [userId, b, a],
    );

    const view = await getDailyView(userId, "2026-10-07", "2026-10-07", NOON_UTC);

    expect(titles(view.days[0].tasks)).toEqual(["b", "a", "c"]);
  });

  it("only sees the caller's tasks", async () => {
    const other = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [other, `other-${other}@example.com`]);
    try {
      const col = await pool.query("INSERT INTO collections (user_id, name, color) VALUES ($1, 'X', '#bababa') RETURNING id", [other]);
      await pool.query("INSERT INTO tasks (user_id, collection_id, title, due_date) VALUES ($1, $2, 'theirs', '2026-10-07')", [other, col.rows[0].id]);

      const view = await getDailyView(userId, "2026-10-07", "2026-10-07", NOON_UTC);

      expect(view.days[0].tasks).toEqual([]);
    } finally {
      await pool.query("DELETE FROM users WHERE id = $1", [other]);
    }
  });

  it("computes today in the user's timezone", async () => {
    await setPrefs({ timeZone: "America/Sao_Paulo" });
    await addTask("late last night", "2026-10-06");

    // 02:00 UTC on the 7th is still the 6th in Sao Paulo (UTC-3).
    const view = await getDailyView(userId, "2026-10-06", "2026-10-06", new Date("2026-10-07T02:00:00Z"));

    expect(view.today).toBe("2026-10-06");
    expect(view.overdue).toEqual([]);
  });

  it("accepts a 42-day range and rejects 43", async () => {
    const ok = await getDailyView(userId, "2026-09-28", "2026-11-08", NOON_UTC);
    expect(ok.days).toHaveLength(42);

    await expect(getDailyView(userId, "2026-09-28", "2026-11-09", NOON_UTC)).rejects.toBeInstanceOf(AppError);
  });

  it("rejects an impossible calendar date, a reversed range, and a bad format", async () => {
    for (const [from, to] of [
      ["2026-02-31", "2026-03-02"],
      ["2026-10-08", "2026-10-07"],
      ["2026-10-07", "abc"],
    ]) {
      const err = await getDailyView(userId, from, to, NOON_UTC).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});
