import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { validateColor } from "../utils/color.js";
import { buildEvent, publishEvent } from "./syncService.js";

const NAME_REGEX = /^[a-zA-Z0-9_]+$/;

interface LabelRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

function formatLabel(row: LabelRow): Label {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publishLabelEvent(
  eventType: "created" | "updated" | "deleted",
  entityId: string,
  userId: string,
  payload?: unknown,
) {
  publishEvent(
    buildEvent({
      entityType: "label",
      eventType,
      entityId,
      userId,
      payload,
    }),
  ).catch((err) => console.error("[sync] publish failed", err));
}

// A task carrying no labels must not need a round trip - callers pass every
// task on a page (or view) through here in one shot.
export async function attachLabels<T extends { id: string }>(items: T[]): Promise<(T & { labels: Label[] })[]> {
  if (items.length === 0) return items as (T & { labels: Label[] })[];

  const result = await pool.query(
    `SELECT tl.task_id, l.* FROM task_labels tl
     INNER JOIN labels l ON l.id = tl.label_id
     WHERE tl.task_id = ANY($1::uuid[])
     ORDER BY l.name ASC`,
    [items.map((item) => item.id)],
  );

  const byTaskId = new Map<string, Label[]>();
  for (const row of result.rows as (LabelRow & { task_id: string })[]) {
    const { task_id, ...labelFields } = row;
    const list = byTaskId.get(task_id) ?? [];
    list.push(formatLabel(labelFields as LabelRow));
    byTaskId.set(task_id, list);
  }

  return items.map((item) => ({ ...item, labels: byTaskId.get(item.id) ?? [] }));
}

// Validates that every id in labelIds exists and belongs to userId - throws a
// 400 on any mismatch. Shared by createTask and updateTask.
export async function verifyLabelOwnership(labelIds: string[], userId: string): Promise<void> {
  if (labelIds.length === 0) return;

  const result = await pool.query(
    `SELECT id FROM labels WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [labelIds, userId],
  );

  if (result.rows.length !== labelIds.length) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "labelIds", message: "One or more labels not found or not accessible" }],
    });
  }
}

const SEED_LABELS = [
  { name: "feature", color: "#7dbfb2" },
  { name: "bug", color: "#c98079" },
  { name: "chore", color: "#adb9c1" },
];

// Only for a user with no labels at all - never runs again once any label exists.
export async function ensureSeedLabels(userId: string): Promise<Label[]> {
  const client = await pool.connect();
  const created: Label[] = [];
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);

    const existing = await client.query(`SELECT id FROM labels WHERE user_id = $1 LIMIT 1`, [userId]);
    if (existing.rows.length === 0) {
      for (const seed of SEED_LABELS) {
        const result = await client.query(
          `INSERT INTO labels (id, user_id, name, color) VALUES ($1, $2, $3, $4) RETURNING *`,
          [uuidv4(), userId, seed.name, seed.color],
        );
        created.push(formatLabel(result.rows[0] as LabelRow));
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  for (const label of created) publishLabelEvent("created", label.id, userId, label);
  return created;
}

function validateName(name: unknown): string {
  if (typeof name !== "string" || name.length < 1 || name.length > 60) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "name", message: "Name must be between 1 and 60 characters" }],
    });
  }

  if (!NAME_REGEX.test(name)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "name", message: "Name must contain only alphanumeric characters and underscores" }],
    });
  }

  return name;
}

async function checkDuplicateName(userId: string, name: string, excludeId?: string): Promise<void> {
  const query = excludeId
    ? `SELECT id FROM labels WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`
    : `SELECT id FROM labels WHERE user_id = $1 AND LOWER(name) = LOWER($2)`;

  const params = excludeId ? [userId, name, excludeId] : [userId, name];
  const result = await pool.query(query, params);

  if (result.rows.length > 0) {
    throw new AppError({
      code: "CONFLICT",
      message: "A label with this name already exists",
      statusCode: 409,
    });
  }
}

export async function listLabels(userId: string) {
  const result = await pool.query(
    `SELECT * FROM labels WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );

  return result.rows.map((row) => formatLabel(row as LabelRow));
}

export interface CreateLabelInput {
  name: string;
  color: string;
}

export async function createLabel(userId: string, input: CreateLabelInput) {
  const name = validateName(input.name);
  const color = validateColor(input.color);

  await checkDuplicateName(userId, name);

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO labels (id, user_id, name, color)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, userId, name, color]
  );

  const label = formatLabel(result.rows[0] as LabelRow);
  publishLabelEvent("created", label.id, userId, label);
  return label;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
}

export async function updateLabel(labelId: string, userId: string, input: UpdateLabelInput) {
  const existing = await pool.query(
    `SELECT * FROM labels WHERE id = $1 AND user_id = $2`,
    [labelId, userId]
  );

  if (existing.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Label not found",
      statusCode: 404,
    });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    const name = validateName(input.name);
    await checkDuplicateName(userId, name, labelId);
    setClauses.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (input.color !== undefined) {
    const color = validateColor(input.color);
    setClauses.push(`color = $${paramIndex++}`);
    values.push(color);
  }

  if (setClauses.length === 0) {
    return formatLabel(existing.rows[0] as LabelRow);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(labelId);

  const query = `UPDATE labels SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
  const result = await pool.query(query, values);

  const label = formatLabel(result.rows[0] as LabelRow);
  publishLabelEvent("updated", label.id, userId, label);
  return label;
}

export async function deleteLabel(labelId: string, userId: string): Promise<{ success: true }> {
  const existing = await pool.query(
    `SELECT id FROM labels WHERE id = $1 AND user_id = $2`,
    [labelId, userId]
  );

  if (existing.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Label not found",
      statusCode: 404,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Remove label associations from all tasks
    await client.query(`DELETE FROM task_labels WHERE label_id = $1`, [labelId]);

    // Delete the label itself
    await client.query(`DELETE FROM labels WHERE id = $1`, [labelId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  publishLabelEvent("deleted", labelId, userId);
  return { success: true };
}
