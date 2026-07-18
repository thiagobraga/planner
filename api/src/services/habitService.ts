import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { buildEvent, publishEvent } from "./syncService.js";

interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  group_id: string | null;
  order_value: number;
}

interface HabitGroupRow {
  id: string;
  user_id: string;
  name: string;
  order_value: number;
}

export interface Habit {
  id: string;
  name: string;
  parentId: string | null;
  groupId: string | null;
  orderValue: number;
  completions: string[];
}

export interface HabitGroup {
  id: string;
  name: string;
  orderValue: number;
}

function formatHabit(row: HabitRow, completions: string[] = []): Habit {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    groupId: row.group_id,
    orderValue: row.order_value,
    completions,
  };
}

function formatGroup(row: HabitGroupRow): HabitGroup {
  return {
    id: row.id,
    name: row.name,
    orderValue: row.order_value,
  };
}

type HabitEntityType = "habit" | "habit_completion" | "habit_group";

function emit(userId: string, entityType: HabitEntityType, eventType: "created" | "updated" | "deleted", entityId: string, payload?: unknown) {
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

async function getOwnedGroup(userId: string, groupId: string): Promise<HabitGroupRow> {
  const result = await pool.query(`SELECT * FROM habit_groups WHERE id = $1 AND user_id = $2`, [groupId, userId]);
  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Habit group not found", statusCode: 404 });
  }
  return result.rows[0] as HabitGroupRow;
}

async function hasChildren(habitId: string): Promise<boolean> {
  const result = await pool.query(`SELECT 1 FROM habits WHERE parent_id = $1 LIMIT 1`, [habitId]);
  return result.rows.length > 0;
}

// Sub-habits are one level deep: the proposed parent must exist, be owned by the
// same user, and not itself be a child.
async function validateParent(userId: string, parentId: string): Promise<void> {
  const parent = await getOwnedHabit(userId, parentId);
  if (parent.parent_id !== null) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "sub-habits cannot have sub-habits of their own",
      statusCode: 400,
    });
  }
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

export interface CreateHabitInput {
  name: string;
  parentId?: string | null;
  groupId?: string | null;
}

export async function createHabit(userId: string, input: CreateHabitInput): Promise<Habit> {
  const validName = validateName(input.name);
  const parentId = input.parentId ?? null;
  // A child belongs to its parent's group implicitly, so it never carries its own.
  const groupId = parentId !== null ? null : (input.groupId ?? null);

  if (parentId !== null) await validateParent(userId, parentId);
  if (groupId !== null) await getOwnedGroup(userId, groupId);

  const result = await pool.query(
    `INSERT INTO habits (user_id, name, parent_id, group_id, order_value)
     VALUES ($1, $2, $3, $4, COALESCE((
       SELECT MAX(order_value) + 1 FROM habits
       WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $3 AND group_id IS NOT DISTINCT FROM $4
     ), 0))
     RETURNING *`,
    [userId, validName, parentId, groupId],
  );
  const row = result.rows[0] as HabitRow;

  // Days the parent completed while it was still a flat habit stay fully complete.
  // Every sub-habit inherits them - including ones added later - so the parent keeps
  // deriving to "full" on those days instead of silently dropping to empty or half.
  // The parent's own rows are kept as the seed for future sub-habits; they are inert
  // while children exist because a parent's state is always derived.
  let completions: string[] = [];
  if (parentId !== null) {
    const seeded = await pool.query(
      `INSERT INTO habit_completions (habit_id, completed_date)
       SELECT $1, completed_date FROM habit_completions WHERE habit_id = $2
       ON CONFLICT (habit_id, completed_date) DO NOTHING
       RETURNING to_char(completed_date, 'YYYY-MM-DD') AS iso`,
      [row.id, parentId],
    );
    completions = (seeded.rows as { iso: string }[]).map((r) => r.iso);
  }

  const habit = formatHabit(row, completions);
  emit(userId, "habit", "created", habit.id, habit);
  return habit;
}

export interface UpdateHabitInput {
  name?: string;
  parentId?: string | null;
  groupId?: string | null;
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

  if (updates.parentId !== undefined) {
    if (updates.parentId !== null) {
      if (updates.parentId === habitId) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "a habit cannot be its own parent", statusCode: 400 });
      }
      // Re-parenting a habit that has children would create a third level.
      if (await hasChildren(habitId)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "a habit with sub-habits cannot become a sub-habit",
          statusCode: 400,
        });
      }
      await validateParent(userId, updates.parentId);
      // Becoming a child clears any group; the parent's group applies instead.
      setClauses.push(`group_id = NULL`);
    }
    setClauses.push(`parent_id = $${paramIndex++}`);
    values.push(updates.parentId);
  }

  if (updates.groupId !== undefined) {
    if (updates.groupId !== null) {
      const target = await getOwnedHabit(userId, habitId);
      const becomingRoot = updates.parentId === null;
      if (target.parent_id !== null && !becomingRoot) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "a sub-habit belongs to its parent's group and cannot be grouped directly",
          statusCode: 400,
        });
      }
      await getOwnedGroup(userId, updates.groupId);
    }
    setClauses.push(`group_id = $${paramIndex++}`);
    values.push(updates.groupId);
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

  // A parent's state is derived from its sub-habits, never stored. Writing a row
  // here would create a second source of truth that the UI never reads.
  if (await hasChildren(habitId)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "parent habit completion is derived from its sub-habits",
      statusCode: 400,
    });
  }

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

export async function listGroups(userId: string): Promise<HabitGroup[]> {
  const result = await pool.query(
    `SELECT * FROM habit_groups WHERE user_id = $1 ORDER BY order_value, created_at`,
    [userId],
  );
  return (result.rows as HabitGroupRow[]).map(formatGroup);
}

export async function createGroup(userId: string, name: string): Promise<HabitGroup> {
  const validName = validateName(name);
  const result = await pool.query(
    `INSERT INTO habit_groups (user_id, name, order_value)
     VALUES ($1, $2, COALESCE((SELECT MAX(order_value) + 1 FROM habit_groups WHERE user_id = $1), 0))
     RETURNING *`,
    [userId, validName],
  );
  const group = formatGroup(result.rows[0] as HabitGroupRow);
  emit(userId, "habit_group", "created", group.id, group);
  return group;
}

export interface UpdateHabitGroupInput {
  name?: string;
  orderValue?: number;
}

export async function updateGroup(userId: string, groupId: string, updates: UpdateHabitGroupInput): Promise<HabitGroup> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(validateName(updates.name));
  }
  if (updates.orderValue !== undefined) {
    if (typeof updates.orderValue !== "number" || !Number.isInteger(updates.orderValue)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "orderValue must be an integer", statusCode: 400 });
    }
    setClauses.push(`order_value = $${paramIndex++}`);
    values.push(updates.orderValue);
  }

  if (setClauses.length === 0) {
    return formatGroup(await getOwnedGroup(userId, groupId));
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(groupId, userId);
  const result = await pool.query(
    `UPDATE habit_groups SET ${setClauses.join(", ")} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Habit group not found", statusCode: 404 });
  }

  const group = formatGroup(result.rows[0] as HabitGroupRow);
  emit(userId, "habit_group", "updated", group.id, group);
  return group;
}

// Habits in the group are ungrouped by the ON DELETE SET NULL foreign key, not deleted.
export async function deleteGroup(userId: string, groupId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM habit_groups WHERE id = $1 AND user_id = $2 RETURNING id`,
    [groupId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError({ code: "NOT_FOUND", message: "Habit group not found", statusCode: 404 });
  }
  emit(userId, "habit_group", "deleted", groupId);
}
