import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { validateColor } from "../utils/color.js";
import { buildEvent, publishEvent } from "./syncService.js";
import { syncCompletionToStatus } from "./completionSync.js";
import type { StatusRow, Status, CreateStatusInput, UpdateStatusInput, DeleteStatusOptions } from "../types/status.js";
export type { Status } from "../types/status.js";

function formatStatus(row: StatusRow): Status {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    color: row.color,
    orderValue: row.order_value,
    nextStatusMode: row.next_status_mode ?? "default",
    nextStatusId: row.next_status_id ?? null,
    acceptStatusId: row.accept_status_id ?? null,
    rejectStatusId: row.reject_status_id ?? null,
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

function invalidReassignment(message: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    statusCode: 400,
    details: [{ field: "reassignToStatusId", message }],
  });
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
  isCompletionStatus?: boolean;
}

const DEFAULT_STATUS_NAMES: Record<string, DefaultStatusName[]> = {
  en: [
    { name: "Backlog" },
    { name: "Todo" },
    { name: "Doing" },
    { name: "Completed", isCompletionStatus: true },
  ],
  "pt-BR": [
    { name: "Backlog" },
    { name: "A fazer" },
    { name: "Fazendo" },
    { name: "Concluído", isCompletionStatus: true },
  ],
};

// Idempotent: two tabs opening the board at once must not double-seed.
export async function ensureCollectionStatuses(collectionId: string, userId: string): Promise<Status[]> {
  await verifyCollectionAccess(collectionId, userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const collectionResult = await client.query(
      `SELECT id, completion_status_id FROM collections WHERE id = $1 FOR UPDATE`,
      [collectionId],
    );
    let completionStatusId = collectionResult.rows[0]?.completion_status_id as string | null | undefined;

    const existing = await client.query(
      `SELECT * FROM task_statuses WHERE collection_id = $1 ORDER BY order_value ASC`,
      [collectionId],
    );

    const statuses = existing.rows as StatusRow[];
    const created: StatusRow[] = [];

    if (statuses.length === 0) {
      const localeResult = await client.query(`SELECT locale FROM preferences WHERE user_id = $1`, [userId]);
      const locale = (localeResult.rows[0]?.locale as string | undefined) ?? "en";
      const defaults = DEFAULT_STATUS_NAMES[locale] ?? DEFAULT_STATUS_NAMES.en;

      for (let i = 0; i < defaults.length; i++) {
        const result = await client.query(
          `INSERT INTO task_statuses (id, collection_id, name, order_value)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [uuidv4(), collectionId, defaults[i].name, i * 1000],
        );
        const row = result.rows[0] as StatusRow;
        created.push(row);
        statuses.push(row);
        if (defaults[i].isCompletionStatus) completionStatusId = row.id;
      }
    }

    if (!completionStatusId && statuses.length > 0) {
      throw new Error(`Collection ${collectionId} has statuses but no completion status`);
    }
    if (completionStatusId && collectionResult.rows[0]?.completion_status_id !== completionStatusId) {
      await client.query(
        `UPDATE collections SET completion_status_id = $1, updated_at = NOW() WHERE id = $2`,
        [completionStatusId, collectionId],
      );
    }

    const completionStatus = statuses.find((status) => status.id === completionStatusId);
    const firstOpenColumn = statuses.find((status) => status.id !== completionStatusId);

    // File status-less tasks explicitly - one state, one representation, rather
    // than treating NULL as "first column" at render time.
    let completedTaskCount = 0;
    if (completionStatus) {
      const completedTasks = await client.query(
        `UPDATE tasks SET status_id = $1, updated_at = NOW()
         WHERE collection_id = $2 AND status_id IS NULL AND is_completed = true
         RETURNING id`,
        [completionStatus.id, collectionId],
      );
      completedTaskCount = completedTasks.rowCount ?? completedTasks.rows.length;
    }

    let openTaskCount = 0;
    if (firstOpenColumn) {
      const openTasks = await client.query(
        `UPDATE tasks SET status_id = $1, updated_at = NOW()
         WHERE collection_id = $2 AND status_id IS NULL AND is_completed = false
         RETURNING id`,
        [firstOpenColumn.id, collectionId],
      );
      openTaskCount = openTasks.rowCount ?? openTasks.rows.length;
    }

    await client.query("COMMIT");

    const formatted = statuses.map((row) => formatStatus(row));
    if (created.length > 0) {
      for (const status of formatted) {
        publishStatusEvent("created", status.id, userId, collectionId, status);
      }
    } else {
      if (completedTaskCount > 0 && completionStatus) {
        publishStatusEvent("updated", completionStatus.id, userId, collectionId, formatStatus(completionStatus));
      }
      if (openTaskCount > 0 && firstOpenColumn) {
        publishStatusEvent("updated", firstOpenColumn.id, userId, collectionId, formatStatus(firstOpenColumn));
      }
    }

    return formatted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
  const id = uuidv4();
  const client = await pool.connect();
  let row: StatusRow;
  try {
    await client.query("BEGIN");

    const collectionResult = await client.query(
      `SELECT id, completion_status_id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))
       FOR UPDATE`,
      [collectionId, userId],
    );
    if (collectionResult.rows.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Collection not found or not accessible",
        statusCode: 404,
      });
    }

    const maxOrder = await client.query(
      `SELECT COALESCE(MAX(order_value), -1000) + 1000 AS next_order
       FROM task_statuses WHERE collection_id = $1`,
      [collectionId],
    );
    const result = await client.query(
      `INSERT INTO task_statuses (id, collection_id, name, color, order_value)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, collectionId, name, color, maxOrder.rows[0].next_order],
    );
    row = result.rows[0] as StatusRow;

    if (!collectionResult.rows[0].completion_status_id) {
      await client.query(
        `UPDATE collections SET completion_status_id = $1, updated_at = NOW() WHERE id = $2`,
        [id, collectionId],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const status = formatStatus(row);
  publishStatusEvent("created", status.id, userId, collectionId, status);
  return status;
}


const destinationColumns = {
  nextStatusId: "next_status_id",
  acceptStatusId: "accept_status_id",
  rejectStatusId: "reject_status_id",
} as const;

function invalidStatusField(field: string, message: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    statusCode: 400,
    details: [{ field, message }],
  });
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

  if (input.nextStatusMode !== undefined && !["default", "custom", "disabled"].includes(input.nextStatusMode)) {
    throw invalidStatusField("nextStatusMode", "Invalid next status mode");
  }
  for (const field of Object.keys(destinationColumns) as (keyof typeof destinationColumns)[]) {
    const value = input[field];
    if (value !== undefined && value !== null && (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))) {
      throw invalidStatusField(field, "Destination must be a status ID or null");
    }
  }
  const nextMode = input.nextStatusMode ?? status.next_status_mode ?? "default";
  const nextId = input.nextStatusId !== undefined ? input.nextStatusId : status.next_status_id;
  if (nextMode === "custom" && !nextId) {
    throw invalidStatusField("nextStatusId", "Custom Next requires a destination");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const destinations = Object.entries(destinationColumns)
      .map(([field]) => ({ field, value: input[field as keyof typeof destinationColumns] }))
      .filter((entry): entry is { field: string; value: string } => typeof entry.value === "string");
    if (destinations.length > 0) {
      const ids = [...new Set(destinations.map((entry) => entry.value))];
      const result = await client.query(
        `SELECT id FROM task_statuses WHERE collection_id = $1 AND id = ANY($2::uuid[])`,
        [status.collection_id, ids],
      );
      const valid = new Set((result.rows as { id: string }[]).map((row) => row.id));
      const invalid = destinations.find((entry) => !valid.has(entry.value));
      if (invalid) throw invalidStatusField(invalid.field, "Destination must belong to the same collection");
    }

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
    if (input.nextStatusMode !== undefined) {
      setClauses.push(`next_status_mode = $${paramIndex++}`);
      values.push(input.nextStatusMode);
    }
    for (const [field, column] of Object.entries(destinationColumns) as [keyof typeof destinationColumns, string][]) {
      if (input[field] !== undefined) {
        setClauses.push(`${column} = $${paramIndex++}`);
        values.push(input[field]);
      }
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

export async function setCollectionCompletionStatus(
  collectionId: string,
  userId: string,
  statusId: string,
): Promise<{ completionStatusId: string }> {
  if (typeof statusId !== "string" || statusId.length === 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "statusId", message: "statusId is required" }],
    });
  }

  const client = await pool.connect();
  let changed: boolean;
  try {
    await client.query("BEGIN");

    const collectionResult = await client.query(
      `SELECT id, completion_status_id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))
       FOR UPDATE`,
      [collectionId, userId],
    );
    if (collectionResult.rows.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Collection not found or not accessible",
        statusCode: 404,
      });
    }

    const statusesResult = await client.query(
      `SELECT * FROM task_statuses WHERE collection_id = $1 ORDER BY id FOR UPDATE`,
      [collectionId],
    );
    if (!(statusesResult.rows as StatusRow[]).some((status) => status.id === statusId)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        statusCode: 400,
        details: [{ field: "statusId", message: "Status must belong to the collection" }],
      });
    }

    const previousCompletionStatusId = collectionResult.rows[0].completion_status_id as string | null;
    changed = previousCompletionStatusId !== statusId;
    if (changed) {
      const affectedResult = await client.query(
        `SELECT id, status_id FROM tasks
         WHERE collection_id = $1
           AND status_id = ANY($2::uuid[])
         ORDER BY CASE WHEN status_id = $3 THEN 0 ELSE 1 END, depth ASC, order_value ASC
         FOR UPDATE`,
        [collectionId, [previousCompletionStatusId, statusId].filter(Boolean), previousCompletionStatusId],
      );

      await client.query(
        `UPDATE collections SET completion_status_id = $1, updated_at = NOW() WHERE id = $2`,
        [statusId, collectionId],
      );
      if (previousCompletionStatusId) {
        // Tasks leaving the former completion column are being reopened, so
        // their old restore target is consumed. Preserve history for tasks in
        // the new completion column so a later reopen can still round-trip.
        await client.query(
          `UPDATE tasks SET previous_status_id = NULL, updated_at = NOW()
           WHERE collection_id = $1 AND status_id = $2`,
          [collectionId, previousCompletionStatusId],
        );
      }

      for (const task of affectedResult.rows as { id: string; status_id: string }[]) {
        await syncCompletionToStatus(client, {
          taskId: task.id,
          userId,
          statusId: task.status_id,
          collectionId,
        });
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (changed) {
    publishStatusEvent("updated", statusId, userId, collectionId, { completionStatusId: statusId });
  }
  return { completionStatusId: statusId };
}


export async function deleteStatus(statusId: string, userId: string, options: DeleteStatusOptions = {}): Promise<{ success: true }> {
  const status = await verifyStatusAccess(statusId, userId);

  const client = await pool.connect();
  let cleanedRoutes: StatusRow[];
  try {
    await client.query("BEGIN");

    const collectionLock = await client.query(
      `SELECT id, completion_status_id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))
       FOR UPDATE`,
      [status.collection_id, userId],
    );
    if (collectionLock.rows.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Collection not found or not accessible",
        statusCode: 404,
      });
    }

    const lockedResult = await client.query(
      `SELECT * FROM task_statuses WHERE collection_id = $1 ORDER BY id FOR UPDATE`,
      [status.collection_id],
    );
    const lockedStatuses = lockedResult.rows as StatusRow[];
    if (!lockedStatuses.some((candidate) => candidate.id === statusId)) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Status not found or not accessible",
        statusCode: 404,
      });
    }
    if (lockedStatuses.length <= 1) {
      throw new AppError({
        code: "CONFLICT",
        message: "Cannot delete the last status in a collection",
        statusCode: 409,
      });
    }

    const reassignToStatusId = options.reassignToStatusId;
    const targetStatus = lockedStatuses.find((candidate) => candidate.id === reassignToStatusId);
    if (reassignToStatusId === statusId) {
      throw invalidReassignment("Reassignment status must be different from the deleted status");
    }
    if (reassignToStatusId !== undefined && !targetStatus) {
      throw invalidReassignment("Reassignment status must belong to the same collection");
    }

    const completionStatusId = collectionLock.rows[0].completion_status_id as string | null;
    if (completionStatusId === statusId && !targetStatus) {
      throw invalidReassignment("Deleting the completion status requires a reassignment status");
    }
    if (completionStatusId === statusId && targetStatus) {
      await client.query(
        `UPDATE collections SET completion_status_id = $1, updated_at = NOW() WHERE id = $2`,
        [targetStatus.id, status.collection_id],
      );
    }

    const reassignedTasks = await client.query(
      `UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE status_id = $2
       RETURNING id, status_id`,
      [reassignToStatusId ?? null, statusId],
    );
    await client.query(
      `UPDATE tasks SET previous_status_id = $1 WHERE previous_status_id = $2`,
      [reassignToStatusId ?? null, statusId],
    );

    if (reassignToStatusId) {
      for (const task of reassignedTasks.rows as { id: string; status_id: string }[]) {
        await syncCompletionToStatus(client, {
          taskId: task.id,
          userId,
          statusId: task.status_id,
          collectionId: status.collection_id,
        });
      }
    }

    const cleaned = await client.query(
      `UPDATE task_statuses
       SET next_status_id = NULLIF(next_status_id, $1),
           accept_status_id = NULLIF(accept_status_id, $1),
           reject_status_id = NULLIF(reject_status_id, $1),
           next_status_mode = CASE WHEN next_status_id = $1 THEN 'disabled' ELSE next_status_mode END,
           updated_at = NOW()
       WHERE collection_id = $2 AND id != $1
         AND (next_status_id = $1 OR accept_status_id = $1 OR reject_status_id = $1)
       RETURNING *`,
      [statusId, status.collection_id],
    );
    cleanedRoutes = (cleaned?.rows ?? []) as StatusRow[];

    await client.query(`DELETE FROM task_statuses WHERE id = $1`, [statusId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  publishStatusEvent("deleted", statusId, userId, status.collection_id);
  for (const cleaned of cleanedRoutes) {
    publishStatusEvent("updated", cleaned.id, userId, status.collection_id, formatStatus(cleaned));
  }
  return { success: true };
}
