import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { createTask, updateTask, completeTask } from "../taskService.js";
import { AppError } from "../../utils/AppError.js";

let userId: string;
let collectionId: string;

async function expectValidationError(promise: Promise<unknown>, field: string): Promise<void> {
  const error = await promise.then(() => undefined, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  const details = (error as AppError).details as Array<{ field: string }>;
  expect(details.map((d) => d.field)).toContain(field);
}

describe("taskService datetime fields (real PostgreSQL)", () => {
  beforeEach(async () => {
    userId = crypto.randomUUID();
    collectionId = crypto.randomUUID();
    await pool.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')`, [
      userId,
      `datetime-${userId}@example.com`,
    ]);
    await pool.query(`INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Work', '#c9483b')`, [
      collectionId,
      userId,
    ]);
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  it("creates a task with due time, deadline and duration", async () => {
    const task = await createTask(userId, {
      title: "Write report",
      collectionId,
      dueDate: "2026-08-14",
      dueTime: "14:30",
      deadlineDate: "2026-08-20",
      deadlineTime: "18:00",
      durationMinutes: 90,
    });

    expect(task.dueTime).toBe("14:30");
    expect(task.deadlineTime).toBe("18:00");
    expect(task.durationMinutes).toBe(90);
    expect(task.startTime).toBe("14:30");
    expect(task.endTime).toBe("16:00");
    expect(task.deadlineDate).not.toBeNull();
  });

  it("updates and clears time fields", async () => {
    const task = await createTask(userId, { title: "Call", collectionId, dueDate: "2026-08-14" });

    const timed = await updateTask(task.id, userId, { dueTime: "09:00", durationMinutes: 30 });
    expect(timed.startTime).toBe("09:00");
    expect(timed.endTime).toBe("09:30");

    const cleared = await updateTask(task.id, userId, { dueTime: null, durationMinutes: null });
    expect(cleared.dueTime).toBeNull();
    expect(cleared.durationMinutes).toBeNull();
    expect(cleared.endTime).toBeNull();
  });

  it("clears the due time when the due date is removed", async () => {
    const task = await createTask(userId, { title: "Gym", collectionId, dueDate: "2026-08-14", dueTime: "07:00" });
    const updated = await updateTask(task.id, userId, { dueDate: null });
    expect(updated.dueTime).toBeNull();
  });

  it("clears the deadline time when the deadline date is removed", async () => {
    const task = await createTask(userId, {
      title: "Taxes",
      collectionId,
      deadlineDate: "2026-08-30",
      deadlineTime: "23:59",
    });
    const updated = await updateTask(task.id, userId, { deadlineDate: null });
    expect(updated.deadlineDate).toBeNull();
    expect(updated.deadlineTime).toBeNull();
  });

  it("rejects a due time without a due date", async () => {
    await expectValidationError(createTask(userId, { title: "x", collectionId, dueTime: "10:00" }), "dueTime");
    const task = await createTask(userId, { title: "y", collectionId });
    await expectValidationError(updateTask(task.id, userId, { dueTime: "10:00" }), "dueTime");
  });

  it("rejects a deadline time without a deadline date", async () => {
    await expectValidationError(
      createTask(userId, { title: "x", collectionId, deadlineTime: "10:00" }),
      "deadlineTime",
    );
  });

  it("carries duration, time and a shifted deadline onto the next recurrence", async () => {
    const task = await createTask(userId, {
      title: "Weekly review",
      collectionId,
      dueDate: "2026-08-14",
      dueTime: "16:00",
      deadlineDate: "2026-08-15",
      deadlineTime: "12:00",
      durationMinutes: 60,
      recurrenceRule: { type: "weekly", interval: 1 },
    });

    await completeTask(task.id, userId);

    const next = await pool.query(
      `SELECT to_char(due_date, 'YYYY-MM-DD') AS due, to_char(deadline_date, 'YYYY-MM-DD') AS deadline,
              deadline_time, duration_minutes
         FROM tasks WHERE user_id = $1 AND NOT is_completed`,
      [userId],
    );
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].due).toBe("2026-08-21");
    expect(next.rows[0].deadline).toBe("2026-08-22");
    expect(next.rows[0].deadline_time.slice(0, 5)).toBe("12:00");
    expect(next.rows[0].duration_minutes).toBe(60);
  });

  async function openDueDates(): Promise<string[]> {
    const result = await pool.query(
      `SELECT to_char(due_date, 'YYYY-MM-DD') AS due FROM tasks WHERE user_id = $1 AND NOT is_completed`,
      [userId],
    );
    return result.rows.map((r) => r.due as string);
  }

  it("counts the next occurrence from the completion day in the user's time zone", async () => {
    await pool.query(
      `INSERT INTO preferences (user_id, time_zone) VALUES ($1, 'America/Sao_Paulo')
       ON CONFLICT (user_id) DO UPDATE SET time_zone = EXCLUDED.time_zone`,
      [userId],
    );
    const task = await createTask(userId, {
      title: "Water plants",
      collectionId,
      dueDate: "2026-10-01",
      recurrenceRule: { type: "daily", interval: 3, fromCompletion: true },
    });

    // 01:30 UTC on the 16th is still the 15th in Sao Paulo
    await completeTask(task.id, userId, new Date("2026-10-16T01:30:00Z"));

    expect(await openDueDates()).toEqual(["2026-10-18"]);
  });

  it("schedules every 2 weeks on Saturday counted from completion", async () => {
    const task = await createTask(userId, {
      title: "Long run",
      collectionId,
      dueDate: "2026-10-17",
      recurrenceRule: { type: "weekly", interval: 2, weekdays: [6], fromCompletion: true },
    });

    await completeTask(task.id, userId, new Date("2026-10-21T12:00:00Z"));

    expect(await openDueDates()).toEqual(["2026-10-31"]);
  });

  it("stops repeating after the until date", async () => {
    const task = await createTask(userId, {
      title: "Course",
      collectionId,
      dueDate: "2026-10-17",
      recurrenceRule: { type: "weekly", interval: 1, until: "2026-10-20" },
    });

    const completed = await completeTask(task.id, userId, new Date("2026-10-17T12:00:00Z"));

    expect(completed.isCompleted).toBe(true);
    expect(await openDueDates()).toEqual([]);
  });
});
