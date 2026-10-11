import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { getDailyRange } from "../dailyService.js";
import { AppError } from "../../utils/AppError.js";

let userId: string;
let collectionId: string;

async function insertTask(title: string, dueDate: string, type = "task") {
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO tasks (id, user_id, collection_id, title, due_date, type) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, userId, collectionId, title, dueDate, type],
  );
  return id;
}

describe("getDailyRange (real PostgreSQL)", () => {
  beforeEach(async () => {
    userId = crypto.randomUUID();
    collectionId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `daily-${userId}@example.com`]);
    await pool.query("INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Work', '#c9483b')", [collectionId, userId]);
    await pool.query("INSERT INTO preferences (user_id) VALUES ($1)", [userId]);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("returns all days, overdue tasks and day order in the user's timezone", async () => {
    await pool.query("UPDATE preferences SET time_zone = 'America/New_York' WHERE user_id = $1", [userId]);
    const old = await insertTask("Old", "2024-06-13");
    const first = await insertTask("First", "2024-06-15");
    const second = await insertTask("Second", "2024-06-15");
    await pool.query("INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position) VALUES ($1, $2, 'day', '2024-06-15', 2000), ($1, $3, 'day', '2024-06-15', 1000)", [userId, first, second]);

    const view = await getDailyRange(userId, "2024-06-14", "2024-06-16", new Date("2024-06-15T03:00:00Z"));
    expect(view.today).toBe("2024-06-14");
    expect(view.overdue.map((task) => task.id)).toEqual([old]);
    expect(view.days.map((day) => day.date)).toEqual(["2024-06-14", "2024-06-15", "2024-06-16"]);
    expect(view.days.map((day) => day.tasks.map((task) => task.id))).toEqual([[], [second, first], []]);
  });

  it("applies visibility preferences and excludes archived collections", async () => {
    await insertTask("Visible", "2024-06-15");
    const completed = await insertTask("Completed", "2024-06-15");
    const note = await insertTask("Note", "2024-06-15", "note");
    await pool.query("UPDATE tasks SET is_completed = true WHERE id = $1", [completed]);
    await pool.query("UPDATE preferences SET hide_completed_tasks = true, show_notes = false WHERE user_id = $1", [userId]);
    const view = await getDailyRange(userId, "2024-06-15", "2024-06-15", new Date("2024-06-15T12:00:00Z"));
    expect(view.days[0].tasks.map((task) => task.title)).toEqual(["Visible"]);
    expect(view.days[0].tasks.some((task) => task.id === note)).toBe(false);
    await pool.query("UPDATE collections SET is_archived = true WHERE id = $1", [collectionId]);
    expect((await getDailyRange(userId, "2024-06-15", "2024-06-15")).days[0].tasks).toEqual([]);
  });

  it("rejects invalid dates, reversed ranges and more than 42 days", async () => {
    for (const [from, to] of [["2024-02-31", "2024-03-01"], ["2024-06-16", "2024-06-15"], ["2024-01-01", "2024-02-12"]]) {
      await expect(getDailyRange(userId, from, to)).rejects.toBeInstanceOf(AppError);
    }
  });
});
