import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { buildEvent, publishEvent } from "./syncService.js";

interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  note: string | null;
  order_value: number;
}

export interface Habit {
  id: string;
  name: string;
  note?: string;
  orderValue: number;
  completions: string[];
}

function formatHabit(row: HabitRow, completions: string[] = []): Habit {
  return {
    id: row.id,
    name: row.name,
    note: row.note ?? undefined,
    orderValue: row.order_value,
    completions,
  };
}

function emit(userId: string, entityType: "habit" | "habit_completion", eventType: "created" | "updated" | "deleted", entityId: string, payload?: unknown) {
  publishEvent(
    buildEvent({ entityType, eventType, entityId, userId, payload }),
  ).catch((err) => console.error("[sync] publish failed", err));
}

function validateName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "name must be a non-empty string of at most 100 characters",
      statusCode: 400,
    });
  }
  return name.trim();
}

async function getOwnedHabit(userId: string, habitId: string): Promise<HabitRow> {
  const result = await pool.query(`SELECT * FROM habits WHERE id = $1 AND user_id = $2`, [habitId, userId]);
  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Habit not found", statusCode: 404 });
  }
  return result.rows[0] as HabitRow;
}

export async function listHabits(userId: string): Promise<Habit[]> {
  const habitsResult = await pool.query(
    `SELECT * FROM habits WHERE user_id = $1 ORDER BY order_value, created_at`,
    [userId],
  );
  const rows = habitsResult.rows as HabitRow[];
  if (rows.length === 0) return [];

  const completionsResult = await pool.query(
    `SELECT habit_id, to_char(completed_date, 'YYYY-MM-DD') AS iso
     FROM habit_completions
     WHERE habit_id = ANY($1)`,
    [rows.map((r) => r.id)],
  );

  const byHabit = new Map<string, string[]>();
  for (const row of completionsResult.rows as { habit_id: string; iso: string }[]) {
    const list = byHabit.get(row.habit_id) ?? [];
    list.push(row.iso);
    byHabit.set(row.habit_id, list);
  }

  return rows.map((r) => formatHabit(r, byHabit.get(r.id) ?? []));
}

export async function createHabit(userId: string, name: string, note?: string): Promise<Habit> {
  const validName = validateName(name);
  const result = await pool.query(
    `INSERT INTO habits (user_id, name, note, order_value)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(order_value) + 1 FROM habits WHERE user_id = $1), 0))
     RETURNING *`,
    [userId, validName, note ?? null],
  );
  const habit = formatHabit(result.rows[0] as HabitRow);
  emit(userId, "habit", "created", habit.id, habit);
  return habit;
}

export interface UpdateHabitInput {
  name?: string;
  note?: string | null;
  orderValue?: number;
}

export async function updateHabit(userId: string, habitId: string, updates: UpdateHabitInput): Promise<Habit> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(validateName(updates.name));
  }
  if (updates.note !== undefined) {
    setClauses.push(`note = $${paramIndex++}`);
    values.push(updates.note ?? null);
  }
  if (updates.orderValue !== undefined) {
    if (typeof updates.orderValue !== "number" || !Number.isInteger(updates.orderValue)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "orderValue must be an integer", statusCode: 400 });
    }
    setClauses.push(`order_value = $${paramIndex++}`);
    values.push(updates.orderValue);
  }

  if (setClauses.length === 0) {
    const row = await getOwnedHabit(userId, habitId);
    return formatHabit(row);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(habitId, userId);
  const result = await pool.query(
    `UPDATE habits SET ${setClauses.join(", ")} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Habit not found", statusCode: 404 });
  }

  const habit = formatHabit(result.rows[0] as HabitRow);
  emit(userId, "habit", "updated", habit.id, habit);
  return habit;
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const result = await pool.query(`DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id`, [habitId, userId]);
  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Habit not found", statusCode: 404 });
  }
  emit(userId, "habit", "deleted", habitId);
}

export interface CompletionResult {
  habitId: string;
  date: string;
  isCompleted: boolean;
}

export async function toggleCompletion(userId: string, habitId: string, date: string, isCompleted: boolean): Promise<CompletionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "date must be YYYY-MM-DD", statusCode: 400 });
  }
  if (typeof isCompleted !== "boolean") {
    throw new AppError({ code: "VALIDATION_ERROR", message: "isCompleted must be a boolean", statusCode: 400 });
  }

  await getOwnedHabit(userId, habitId);

  if (isCompleted) {
    await pool.query(
      `INSERT INTO habit_completions (habit_id, completed_date) VALUES ($1, $2)
       ON CONFLICT (habit_id, completed_date) DO NOTHING`,
      [habitId, date],
    );
  } else {
    await pool.query(`DELETE FROM habit_completions WHERE habit_id = $1 AND completed_date = $2`, [habitId, date]);
  }

  const payload: CompletionResult = { habitId, date, isCompleted };
  emit(userId, "habit_completion", isCompleted ? "created" : "deleted", `${habitId}:${date}`, payload);
  return payload;
}
