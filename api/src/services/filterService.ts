import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { parseFilter, type FilterParseError } from "../parsers/filterParser.js";
import { evaluateFilter, type EvalTask, type EvalContext } from "./filterEvaluator.js";

interface FilterRow {
  id: string;
  user_id: string;
  name: string;
  query: string;
  created_at: string;
  updated_at: string;
}

function formatFilter(row: FilterRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    query: row.query,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateName(name: unknown): string {
  if (typeof name !== "string" || name.length < 1 || name.length > 120) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "name", message: "Name must be between 1 and 120 characters" }],
    });
  }
  return name;
}

function validateQuery(query: unknown): string {
  if (typeof query !== "string" || query.length === 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "query", message: "Query is required" }],
    });
  }

  try {
    parseFilter(query);
  } catch (e) {
    const err = e as FilterParseError;
    throw new AppError({
      code: "FILTER_PARSE_ERROR",
      message: "Invalid filter query",
      statusCode: 400,
      details: [{ field: "query", message: err.message, position: err.position }],
    });
  }

  return query;
}

export interface CreateFilterInput {
  name: string;
  query: string;
}

export async function createFilter(userId: string, input: CreateFilterInput) {
  const name = validateName(input.name);
  const query = validateQuery(input.query);

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO filters (id, user_id, name, query)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, userId, name, query],
  );

  return formatFilter(result.rows[0] as FilterRow);
}

export interface UpdateFilterInput {
  name?: string;
  query?: string;
}

export async function updateFilter(filterId: string, userId: string, input: UpdateFilterInput) {
  const existing = await pool.query(
    `SELECT * FROM filters WHERE id = $1 AND user_id = $2`,
    [filterId, userId],
  );

  if (existing.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Filter not found",
      statusCode: 404,
    });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    const name = validateName(input.name);
    setClauses.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (input.query !== undefined) {
    const query = validateQuery(input.query);
    setClauses.push(`query = $${paramIndex++}`);
    values.push(query);
  }

  if (setClauses.length === 0) {
    return formatFilter(existing.rows[0] as FilterRow);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(filterId);

  const sql = `UPDATE filters SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
  const result = await pool.query(sql, values);
  return formatFilter(result.rows[0] as FilterRow);
}

export async function listFilters(userId: string) {
  const result = await pool.query(
    `SELECT * FROM filters WHERE user_id = $1 ORDER BY name ASC`,
    [userId],
  );
  return result.rows.map((r) => formatFilter(r as FilterRow));
}

export async function deleteFilter(filterId: string, userId: string): Promise<{ success: true }> {
  const result = await pool.query(
    `DELETE FROM filters WHERE id = $1 AND user_id = $2 RETURNING id`,
    [filterId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Filter not found",
      statusCode: 404,
    });
  }

  return { success: true };
}

export async function evaluateSavedFilter(filterId: string, userId: string, today: string): Promise<EvalTask[]> {
  const filterResult = await pool.query(
    `SELECT * FROM filters WHERE id = $1 AND user_id = $2`,
    [filterId, userId],
  );

  if (filterResult.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Filter not found",
      statusCode: 404,
    });
  }

  const filterRow = filterResult.rows[0] as FilterRow;
  const expr = parseFilter(filterRow.query);

  // Load all tasks owned or shared with the user, with collection name and labels
  const tasksResult = await pool.query(
    `SELECT
       t.id, t.title, t.description, t.priority,
       t.due_date, t.is_completed,
       p.name AS collection_name,
       u.email AS assignee_email,
       COALESCE(array_agg(l.name) FILTER (WHERE l.id IS NOT NULL), '{}') AS label_names
     FROM tasks t
     JOIN collections p ON p.id = t.collection_id
     LEFT JOIN users u ON u.id = t.assignee_user_id
     LEFT JOIN task_labels tl ON tl.task_id = t.id
     LEFT JOIN labels l ON l.id = tl.label_id
     WHERE (t.user_id = $1 OR t.collection_id IN (SELECT collection_id FROM collaborators WHERE user_id = $1))
     GROUP BY t.id, p.name, u.email`,
    [userId],
  );

  const tasks: EvalTask[] = tasksResult.rows.map((r: {
    id: string;
    title: string;
    description: string | null;
    priority: 1 | 2 | 3 | 4;
    due_date: string | null;
    is_completed: boolean;
    collection_name: string;
    assignee_email: string | null;
    label_names: string[];
  }) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    dueDate: r.due_date,
    isCompleted: r.is_completed,
    collectionName: r.collection_name,
    assigneeUser: r.assignee_email,
    labelNames: r.label_names ?? [],
  }));

  const ctx: EvalContext = { today, currentUser: userId };
  return evaluateFilter(expr, tasks, ctx);
}
