import type { PoolClient } from "pg";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import type { DocumentNode, TaskDocumentDto } from "../contracts/document.js";
import type { TaskRow } from "../types/task.js";
import { runMutation } from "./mutationRunner.js";
import { attachLabels } from "./labelService.js";
import { getAccessibleTask } from "./task/access.js";
import { taskEvent } from "./task/events.js";
import { formatTask } from "./task/format.js";
import { parseDocumentPut } from "./document/validate.js";
import { documentToPlainText, referencedTaskIds } from "./document/plainText.js";
import { documentDto, findDocumentRow, insertFirstRevision, seededDto, updateFromRevision } from "./document/store.js";

export async function getTaskDocument(taskId: string, userId: string): Promise<TaskDocumentDto> {
  const task = await getAccessibleTask(taskId, userId);
  const row = await findDocumentRow(pool, taskId);
  return row ? documentDto(row) : seededDto(task);
}

// Titles only for tasks in the document's own collection: everyone who can
// read the description can already see those, so no title leaks across.
async function referenceTitles(client: PoolClient, content: DocumentNode, collectionId: string): Promise<Map<string, string>> {
  const ids = referencedTaskIds(content);
  if (ids.length === 0) return new Map();
  const result = await client.query<{ id: string; title: string }>(
    "SELECT id, title FROM tasks WHERE id = ANY($1::uuid[]) AND collection_id = $2",
    [ids, collectionId],
  );
  return new Map(result.rows.map((r) => [r.id, r.title]));
}

async function conflict(client: PoolClient, task: TaskRow, baseRevision: number): Promise<never> {
  const row = await findDocumentRow(client, task.id);
  const current = row ? documentDto(row) : seededDto(task);
  throw new AppError({
    code: "DOCUMENT_CONFLICT",
    message: `The document is at revision ${current.revision}, not ${baseRevision}. Merge with the current content and save again from that revision.`,
    statusCode: 409,
    details: [{ current }],
  });
}

/**
 * Save a task's document if `baseRevision` is still current, and in the same
 * transaction re-derive tasks.description, record activity and queue the task
 * update event, which publishes only after COMMIT.
 */
export async function putTaskDocument(taskId: string, userId: string, body: unknown): Promise<TaskDocumentDto> {
  const { content, baseRevision } = parseDocumentPut(body);

  return runMutation(async (tx) => {
    const task = await getAccessibleTask(taskId, userId, tx.client);
    const row = baseRevision === 0
      ? await insertFirstRevision(tx.client, taskId, content, userId)
      : await updateFromRevision(tx.client, taskId, content, baseRevision, userId);
    if (!row) return conflict(tx.client, task, baseRevision);

    const derived = documentToPlainText(content, await referenceTitles(tx.client, content, task.collection_id));
    const updated = await tx.client.query<TaskRow>(
      "UPDATE tasks SET description = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
      [taskId, derived === "" ? null : derived],
    );
    const [formatted] = await attachLabels([formatTask(updated.rows[0])], tx.client);
    const document = documentDto(row);

    await tx.recordActivity({
      userId,
      collectionId: formatted.collectionId,
      entityType: "task",
      entityId: taskId,
      eventType: "task_updated",
      afterData: { title: formatted.title, fields: ["document"], revision: document.revision },
    });
    tx.emit(taskEvent("updated", userId, formatted));
    return document;
  });
}
