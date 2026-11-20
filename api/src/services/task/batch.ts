import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../db/pool.js";
import { redisClient } from "../../db/redis.js";
import { AppError } from "../../utils/AppError.js";
import type { TaskRow } from "../../types/task.js";
import { attachLabels, verifyLabelOwnership } from "../labelService.js";
import { runMutation } from "../mutationRunner.js";
import { getAccessibleTask } from "./access.js";
import { taskEvent } from "./events.js";
import { formatTask } from "./format.js";
import {
  MAX_DEPTH,
  validateTaskScalarFields,
  validateTimeNeedsDate,
  validationError,
} from "./validation.js";

export const MAX_BATCH_TASKS = 50;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const BATCH_TTL_SECONDS = 86400;

export interface BatchTaskItemInput {
  title: string;
  description?: string | null;
  priority?: number;
  type?: "task" | "note" | "event";
  parentTaskId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  labelIds?: string[];
}

export interface BatchCreateTasksInput {
  idempotencyKey: string;
  collectionId?: string;
  parentTaskId?: string | null;
  tasks: BatchTaskItemInput[];
}

interface StoredBatchRecord {
  payloadHash: string;
  taskIds: string[];
}

function batchRedisKey(userId: string, idempotencyKey: string): string {
  return `idempotency:task-batch:${userId}:${idempotencyKey}`;
}

function computePayloadHash(input: BatchCreateTasksInput): string {
  const normalized = {
    collectionId: input.collectionId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    tasks: input.tasks.map((item) => ({
      title: item.title,
      description: item.description ?? null,
      priority: item.priority ?? 4,
      type: item.type ?? "task",
      parentTaskId: item.parentTaskId ?? null,
      dueDate: item.dueDate ?? null,
      dueTime: item.dueTime ?? null,
      deadlineDate: item.deadlineDate ?? null,
      deadlineTime: item.deadlineTime ?? null,
      labelIds: [...(item.labelIds ?? [])].sort(),
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function batchCreateTasks(userId: string, input: BatchCreateTasksInput) {
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY_RE.test(input.idempotencyKey)) {
    throw validationError("idempotencyKey", "idempotencyKey must be 1-128 letters, digits, _, ., : or -");
  }
  if (!Array.isArray(input.tasks) || input.tasks.length < 1 || input.tasks.length > MAX_BATCH_TASKS) {
    throw validationError("tasks", `Batch must contain between 1 and ${MAX_BATCH_TASKS} tasks`);
  }

  const payloadHash = computePayloadHash(input);
  const redisKey = batchRedisKey(userId, input.idempotencyKey);
  const existingRaw = await redisClient.get(redisKey);
  if (existingRaw) {
    const existing = JSON.parse(existingRaw) as StoredBatchRecord;
    if (existing.payloadHash !== payloadHash) {
      throw new AppError({
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency key was already used with a different batch payload",
        statusCode: 409,
      });
    }
    const rowsResult = await pool.query<TaskRow>(
      "SELECT * FROM tasks WHERE id = ANY($1::uuid[])",
      [existing.taskIds],
    );
    const byId = new Map(rowsResult.rows.map((row) => [row.id, formatTask(row)]));
    const ordered = existing.taskIds
      .map((id) => byId.get(id))
      .filter((t): t is ReturnType<typeof formatTask> => Boolean(t));
    const tasks = await attachLabels(ordered);
    return { tasks, deduplicated: true };
  }

  for (const item of input.tasks) {
    validateTaskScalarFields({
      title: item.title,
      priority: item.priority,
      type: item.type,
      requireTitle: true,
    });
    validateTimeNeedsDate(item, item.dueDate, item.deadlineDate);
    if (item.labelIds?.length) {
      await verifyLabelOwnership(item.labelIds, userId);
    }
  }

  const createdTasks = await runMutation(async (tx) => {
    let defaultCollectionId = input.collectionId;
    let defaultSectionId: string | null = null;
    let defaultDepth = 0;

    if (input.parentTaskId) {
      const parent = await getAccessibleTask(input.parentTaskId, userId, tx.client);
      defaultCollectionId = parent.collection_id;
      defaultSectionId = parent.section_id;
      defaultDepth = parent.depth + 1;
      if (defaultDepth > MAX_DEPTH) {
        throw new AppError({
          code: "MAX_DEPTH_EXCEEDED",
          message: "Maximum subtask nesting depth of 5 exceeded",
          statusCode: 400,
        });
      }
    }

    if (!defaultCollectionId) {
      const inboxResult = await tx.client.query<{ id: string }>(
        "SELECT id FROM collections WHERE user_id = $1 AND is_inbox = true",
        [userId],
      );
      defaultCollectionId = inboxResult.rows[0]?.id;
    }

    if (defaultCollectionId) {
      const access = await tx.client.query(
        `SELECT id FROM collections
         WHERE id = $1
           AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
        [defaultCollectionId, userId],
      );
      if (access.rows.length === 0) {
        throw validationError("collectionId", "Collection not accessible");
      }
    }

    const createdRows: TaskRow[] = [];
    for (const item of input.tasks) {
      let collectionId = defaultCollectionId;
      let sectionId = defaultSectionId;
      let depth = defaultDepth;
      const parentId = item.parentTaskId !== undefined ? item.parentTaskId : (input.parentTaskId ?? null);

      if (parentId && parentId !== input.parentTaskId) {
        const parent = await getAccessibleTask(parentId, userId, tx.client);
        collectionId = parent.collection_id;
        sectionId = parent.section_id;
        depth = parent.depth + 1;
        if (depth > MAX_DEPTH) {
          throw new AppError({
            code: "MAX_DEPTH_EXCEEDED",
            message: "Maximum subtask nesting depth of 5 exceeded",
            statusCode: 400,
          });
        }
      }

      const id = uuidv4();
      const result = await tx.client.query<TaskRow>(
        `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, description, priority, due_date, depth, type, order_value, due_time, deadline_date, deadline_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
           (SELECT COALESCE(MAX(order_value) + 1000, 0) FROM tasks
            WHERE collection_id IS NOT DISTINCT FROM $3::uuid
              AND section_id IS NOT DISTINCT FROM $4::uuid
              AND parent_task_id IS NOT DISTINCT FROM $5::uuid),
           $12, $13, $14)
         RETURNING *`,
        [
          id,
          userId,
          collectionId,
          sectionId,
          parentId,
          item.title,
          item.description ?? null,
          item.priority ?? 4,
          item.dueDate ?? null,
          depth,
          item.type ?? "task",
          item.dueTime ?? null,
          item.deadlineDate ?? null,
          item.deadlineTime ?? null,
        ],
      );
      const labelIds = item.labelIds ?? [];
      if (labelIds.length > 0) {
        const placeholders = labelIds.map((_, i) => `($1, $${i + 2})`).join(", ");
        await tx.client.query(`INSERT INTO task_labels (task_id, label_id) VALUES ${placeholders}`, [id, ...labelIds]);
      }
      createdRows.push(result.rows[0]);
    }

    const formatted = await attachLabels(createdRows.map(formatTask), tx.client);
    for (const task of formatted) {
      await tx.recordActivity({
        userId,
        collectionId: task.collectionId,
        entityType: "task",
        entityId: task.id,
        eventType: "task_created",
        afterData: { title: task.title },
      });
      tx.emit(taskEvent("created", userId, task));
    }
    return formatted;
  });

  const record: StoredBatchRecord = {
    payloadHash,
    taskIds: createdTasks.map((t) => t.id),
  };
  await redisClient.set(redisKey, JSON.stringify(record), { EX: BATCH_TTL_SECONDS });

  return { tasks: createdTasks, deduplicated: false };
}
