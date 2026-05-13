import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

const SUPPORTED_COLORS = [
  "berry_red",
  "red",
  "orange",
  "yellow",
  "olive_green",
  "lime_green",
  "green",
  "mint_green",
  "teal",
  "sky_blue",
  "light_blue",
  "blue",
  "grape",
  "violet",
  "lavender",
  "magenta",
  "salmon",
  "charcoal",
  "grey",
  "taupe",
] as const;

const NAME_REGEX = /^[a-zA-Z0-9_]+$/;

interface LabelRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

function formatLabel(row: LabelRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

function validateColor(color: unknown): string {
  if (!SUPPORTED_COLORS.includes(color as (typeof SUPPORTED_COLORS)[number])) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "color", message: "Invalid color value" }],
    });
  }

  return color as string;
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

  return formatLabel(result.rows[0] as LabelRow);
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

  return formatLabel(result.rows[0] as LabelRow);
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

  return { success: true };
}
