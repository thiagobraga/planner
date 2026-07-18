import { v4 as uuidv4 } from "uuid";
import sanitizeHtml from "sanitize-html";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

function formatComment(row: CommentRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateBody(body: unknown): string {
  if (typeof body !== "string" || body.length < 1 || body.length > 15000) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "body", message: "Comment body must be between 1 and 15000 characters" }],
    });
  }
  return sanitizeHtml(body, SANITIZE_OPTIONS);
}

async function verifyTaskAccess(taskId: string, userId: string): Promise<{ user_id: string; collection_id: string }> {
  const result = await pool.query(
    `SELECT t.user_id, t.collection_id FROM tasks t
     WHERE t.id = $1
       AND (t.user_id = $2 OR t.collection_id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [taskId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Task not found",
      statusCode: 404,
    });
  }

  return result.rows[0] as { user_id: string; collection_id: string };
}

async function loadComment(commentId: string): Promise<CommentRow> {
  const result = await pool.query(`SELECT * FROM comments WHERE id = $1`, [commentId]);
  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Comment not found",
      statusCode: 404,
    });
  }
  return result.rows[0] as CommentRow;
}

export async function listComments(taskId: string, userId: string) {
  await verifyTaskAccess(taskId, userId);
  const result = await pool.query(
    `SELECT * FROM comments WHERE task_id = $1 ORDER BY created_at ASC`,
    [taskId],
  );
  return result.rows.map((r) => formatComment(r as CommentRow));
}

export async function createComment(taskId: string, userId: string, body: string) {
  const validated = validateBody(body);
  await verifyTaskAccess(taskId, userId);

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO comments (id, task_id, user_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, taskId, userId, validated],
  );

  return formatComment(result.rows[0] as CommentRow);
}

export async function updateComment(commentId: string, userId: string, body: string) {
  const validated = validateBody(body);
  const comment = await loadComment(commentId);

  // Verify task access (collaborator/owner)
  await verifyTaskAccess(comment.task_id, userId);

  // Only the author can edit
  if (comment.user_id !== userId) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only the author can edit this comment",
      statusCode: 403,
    });
  }

  const result = await pool.query(
    `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [validated, commentId],
  );

  return formatComment(result.rows[0] as CommentRow);
}

export async function deleteComment(commentId: string, userId: string): Promise<{ success: true }> {
  const comment = await loadComment(commentId);
  const task = await verifyTaskAccess(comment.task_id, userId);

  // Author or task owner can delete
  if (comment.user_id !== userId && task.user_id !== userId) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only the author or task owner can delete this comment",
      statusCode: 403,
    });
  }

  await pool.query(`DELETE FROM comments WHERE id = $1`, [commentId]);
  return { success: true };
}
