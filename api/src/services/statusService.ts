import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { validateColor } from "../utils/color.js";
import { buildEvent, publishEvent } from "./syncService.js";

interface StatusRow {
  id: string;
  collection_id: string;
  name: string;
  color: string;
  is_done_like: boolean;
  order_value: number;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  collectionId: string;
  name: string;
  color: string;
  isDoneLike: boolean;
  orderValue: number;
  createdAt: string;
  updatedAt: string;
}

function formatStatus(row: StatusRow): Status {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    color: row.color,
    isDoneLike: row.is_done_like,
    orderValue: row.order_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publishStatusEvent(
  eventType: "created" | "updated" | "deleted",
  entityId: string,
  userId: string,
  collectionId: string,
  payload?: unknown,
) {
  publishEvent(
    buildEvent({
      entityType: "status",
      eventType,
      entityId,
      userId,
      collectionId,
      payload,
    }),
  ).catch((err) => console.error("[sync] publish failed", err));
}

async function verifyCollectionAccess(collectionId: string, userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM collections
     WHERE id = $1
       AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [collectionId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Collection not found or not accessible",
      statusCode: 404,
    });
  }
}

async function verifyStatusAccess(statusId: string, userId: string): Promise<StatusRow> {
  const result = await pool.query(
    `SELECT s.* FROM task_statuses s
     INNER JOIN collections p ON s.collection_id = p.id
     WHERE s.id = $1
       AND (p.user_id = $2 OR p.id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [statusId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Status not found or not accessible",
      statusCode: 404,
    });
  }

  return result.rows[0] as StatusRow;
}

export async function listStatuses(collectionId: string, userId: string): Promise<Status[]> {
  await verifyCollectionAccess(collectionId, userId);

  const result = await pool.query(
    `SELECT * FROM task_statuses WHERE collection_id = $1 ORDER BY order_value ASC`,
    [collectionId],
  );

  return result.rows.map((row) => formatStatus(row as StatusRow));
}

interface DefaultStatusName {
  name: string;
  isDoneLike: boolean;
}

const DEFAULT_STATUS_NAMES: Record<string, DefaultStatusName[]> = {
  en: [
    { name: "Backlog", isDoneLike: false },
    { name: "Todo", isDoneLike: false },
    { name: "Doing", isDoneLike: false },
    { name: "Completed", isDoneLike: true },
  ],
  "pt-BR": [
    { name: "Backlog", isDoneLike: false },
    { name: "A fazer", isDoneLike: false },
    { name: "Fazendo", isDoneLike: false },
    { name: "Concluído", isDoneLike: true },
  ],
};

// Idempotent: two tabs opening the board at once must not double-seed.
export async function ensureCollectionStatuses(collectionId: string, userId: string): Promise<Status[]> {
  await verifyCollectionAccess(collectionId, userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`SELECT id FROM collections WHERE id = $1 FOR UPDATE`, [collectionId]);

    const existing = await client.query(
      `SELECT * FROM task_statuses WHERE collection_id = $1 ORDER BY order_value ASC`,
      [collectionId],
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return existing.rows.map((row) => formatStatus(row as StatusRow));
    }

    const localeResult = await client.query(`SELECT locale FROM preferences WHERE user_id = $1`, [userId]);
    const locale = (localeResult.rows[0]?.locale as string | undefined) ?? "en";
    const defaults = DEFAULT_STATUS_NAMES[locale] ?? DEFAULT_STATUS_NAMES.en;

    const created: StatusRow[] = [];
    for (let i = 0; i < defaults.length; i++) {
      const result = await client.query(
        `INSERT INTO task_statuses (id, collection_id, name, is_done_like, order_value)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [uuidv4(), collectionId, defaults[i].name, defaults[i].isDoneLike, i * 1000],
      );
      created.push(result.rows[0] as StatusRow);
    }

    const firstDoneLike = created.find((s) => s.is_done_like) ?? created[created.length - 1];
    const firstColumn = created[0];

    // File status-less tasks explicitly - one state, one representation, rather
    // than treating NULL as "first column" at render time.
    await client.query(
      `UPDATE tasks SET status_id = $1, updated_at = NOW()
       WHERE collection_id = $2 AND status_id IS NULL AND is_completed = true`,
      [firstDoneLike.id, collectionId],
    );
    await client.query(
      `UPDATE tasks SET status_id = $1, updated_at = NOW()
       WHERE collection_id = $2 AND status_id IS NULL AND is_completed = false`,
      [firstColumn.id, collectionId],
    );

    await client.query("COMMIT");

    return created.map((row) => formatStatus(row));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface CreateStatusInput {
  name: string;
  color?: string;
  isDoneLike?: boolean;
}

function validateStatusName(name: unknown): string {
  if (typeof name !== "string" || name.length === 0 || name.length > 60) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "name", message: "Name must be between 1 and 60 characters" }],
    });
  }
  return name;
}

export async function createStatus(collectionId: string, userId: string, input: CreateStatusInput): Promise<Status> {
  const name = validateStatusName(input.name);
  const color = input.color !== undefined ? validateColor(input.color) : "#adb9c1";

  await verifyCollectionAccess(collectionId, userId);

  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(order_value), -1000) + 1000 AS next_order FROM task_statuses WHERE collection_id = $1`,
    [collectionId],
  );
  const orderValue = maxOrder.rows[0].next_order;

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO task_statuses (id, collection_id, name, color, is_done_like, order_value)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, collectionId, name, color, input.isDoneLike ?? false, orderValue],
  );

  const status = formatStatus(result.rows[0] as StatusRow);
  publishStatusEvent("created", status.id, userId, collectionId, status);
  return status;
}

export interface UpdateStatusInput {
  name?: string;
  color?: string;
  isDoneLike?: boolean;
  position?: number;
}

export async function updateStatus(statusId: string, userId: string, input: UpdateStatusInput): Promise<Status> {
  if (input.name !== undefined) validateStatusName(input.name);
  if (input.color !== undefined) validateColor(input.color);
  if (input.position !== undefined) {
    if (!Number.isInteger(input.position) || input.position < 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        statusCode: 400,
        details: [{ field: "position", message: "Position must be a non-negative integer" }],
      });
    }
  }

  const status = await verifyStatusAccess(statusId, userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.color !== undefined) {
      setClauses.push(`color = $${paramIndex++}`);
      values.push(input.color);
    }
    if (input.isDoneLike !== undefined) {
      setClauses.push(`is_done_like = $${paramIndex++}`);
      values.push(input.isDoneLike);
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(statusId);
      await client.query(
        `UPDATE task_statuses SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
        values,
      );
    }

    if (input.position !== undefined) {
      const siblingsResult = await client.query(
        `SELECT id, order_value FROM task_statuses
         WHERE collection_id = $1 AND id != $2
         ORDER BY order_value ASC`,
        [status.collection_id, statusId],
      );

      const siblings = siblingsResult.rows as { id: string; order_value: number }[];
      const clampedPosition = Math.min(input.position, siblings.length);

      siblings.splice(clampedPosition, 0, { id: statusId, order_value: 0 });

      for (let i = 0; i < siblings.length; i++) {
        await client.query(
          `UPDATE task_statuses SET order_value = $1, updated_at = NOW() WHERE id = $2`,
          [i * 1000, siblings[i].id],
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const updated = await pool.query("SELECT * FROM task_statuses WHERE id = $1", [statusId]);
  const formatted = formatStatus(updated.rows[0] as StatusRow);
  publishStatusEvent("updated", formatted.id, userId, formatted.collectionId, formatted);
  return formatted;
}

export interface DeleteStatusOptions {
  reassignToStatusId?: string;
}

export async function deleteStatus(statusId: string, userId: string, options: DeleteStatusOptions = {}): Promise<{ success: true }> {
  const status = await verifyStatusAccess(statusId, userId);

  const siblingCount = await pool.query(
    `SELECT COUNT(*)::int AS count FROM task_statuses WHERE collection_id = $1`,
    [status.collection_id],
  );
  if (siblingCount.rows[0].count <= 1) {
    throw new AppError({
      code: "CONFLICT",
      message: "Cannot delete the last status in a collection",
      statusCode: 409,
    });
  }

  if (options.reassignToStatusId) {
    await verifyStatusAccess(options.reassignToStatusId, userId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE status_id = $2`,
      [options.reassignToStatusId ?? null, statusId],
    );
    await client.query(
      `UPDATE tasks SET previous_status_id = $1 WHERE previous_status_id = $2`,
      [options.reassignToStatusId ?? null, statusId],
    );

    await client.query(`DELETE FROM task_statuses WHERE id = $1`, [statusId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  publishStatusEvent("deleted", statusId, userId, status.collection_id);
  return { success: true };
}
