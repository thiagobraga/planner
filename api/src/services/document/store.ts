import type { Pool, PoolClient } from "pg";
import pool from "../../db/pool.js";
import { AppError } from "../../utils/AppError.js";
import type { DocumentNode, TaskDocumentDto } from "../../contracts/document.js";
import type { TaskDocumentRow } from "../../types/document.js";
import { seedDocument } from "./plainText.js";

export const DOCUMENT_SCHEMA_VERSION = 1;

type Db = Pool | PoolClient;

export function documentDto(row: TaskDocumentRow): TaskDocumentDto {
  return {
    taskId: row.task_id,
    content: row.content as DocumentNode,
    schemaVersion: row.schema_version,
    revision: Number(row.revision),
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
  };
}

/** Revision 0: what the client edits before anything is stored. */
export function seededDto(task: { id: string; description: string | null }): TaskDocumentDto {
  return {
    taskId: task.id,
    content: seedDocument(task.description),
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    revision: 0,
    updatedAt: null,
    updatedBy: null,
  };
}

export async function findDocumentRow(db: Db, taskId: string): Promise<TaskDocumentRow | null> {
  const result = await db.query<TaskDocumentRow>("SELECT * FROM task_documents WHERE task_id = $1", [taskId]);
  return result.rows[0] ?? null;
}

// Both writes are compare-and-swap: a concurrent writer holding the row (or
// the primary key) makes this one wait, then match nothing, and report null.
export async function insertFirstRevision(db: Db, taskId: string, content: DocumentNode, userId: string): Promise<TaskDocumentRow | null> {
  const result = await db.query<TaskDocumentRow>(
    `INSERT INTO task_documents (task_id, content, schema_version, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (task_id) DO NOTHING
     RETURNING *`,
    [taskId, JSON.stringify(content), DOCUMENT_SCHEMA_VERSION, userId],
  );
  return result.rows[0] ?? null;
}

export async function updateFromRevision(
  db: Db,
  taskId: string,
  content: DocumentNode,
  baseRevision: number,
  userId: string,
): Promise<TaskDocumentRow | null> {
  const result = await db.query<TaskDocumentRow>(
    `UPDATE task_documents
     SET content = $2, schema_version = $3, revision = revision + 1, updated_at = NOW(), updated_by = $4
     WHERE task_id = $1 AND revision = $5
     RETURNING *`,
    [taskId, JSON.stringify(content), DOCUMENT_SCHEMA_VERSION, userId, baseRevision],
  );
  return result.rows[0] ?? null;
}

/**
 * A plain description write would silently replace a rich document's
 * projection, so once a document exists the caller must edit the document.
 */
export async function assertDescriptionWritable(taskId: string, db: Db = pool): Promise<void> {
  const result = await db.query<{ revision: string }>("SELECT revision FROM task_documents WHERE task_id = $1", [taskId]);
  if (result.rows.length === 0) return;
  const revision = Number(result.rows[0].revision);
  throw new AppError({
    code: "DOCUMENT_EXISTS",
    message: `This task has a rich document (revision ${revision}). Edit it with PUT /api/v1/tasks/${taskId}/document and baseRevision ${revision} instead of writing the description.`,
    statusCode: 409,
    details: [{ revision }],
  });
}
