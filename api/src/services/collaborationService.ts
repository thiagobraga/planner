import { v4 as uuidv4 } from "uuid";
import { createHash, randomBytes } from "crypto";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface InvitationRow {
  id: string;
  collection_id: string;
  email: string;
  token_hash: string;
  accepted_at: string | null;
  created_at: string;
}

interface CollaboratorRow {
  id: string;
  collection_id: string;
  user_id: string;
  created_at: string;
}

function formatInvitation(row: InvitationRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    email: row.email,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function formatCollaborator(row: CollaboratorRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyCollectionOwnership(collectionId: string, userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
    [collectionId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only the collection owner can perform this action",
      statusCode: 403,
    });
  }
}

export async function inviteToCollection(collectionId: string, ownerId: string, email: string) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "email", message: "Invalid email format" }],
    });
  }

  await verifyCollectionOwnership(collectionId, ownerId);

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const id = uuidv4();

  const result = await pool.query(
    `INSERT INTO collection_invitations (id, collection_id, email, token_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, collectionId, email.toLowerCase(), tokenHash],
  );

  return { invitation: formatInvitation(result.rows[0] as InvitationRow), token };
}

export async function acceptInvitation(token: string, userId: string) {
  const tokenHash = hashToken(token);

  const inviteResult = await pool.query(
    `SELECT * FROM collection_invitations WHERE token_hash = $1`,
    [tokenHash],
  );

  if (inviteResult.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Invitation not found or expired",
      statusCode: 404,
    });
  }

  const invitation = inviteResult.rows[0] as InvitationRow;

  if (invitation.accepted_at !== null) {
    throw new AppError({
      code: "CONFLICT",
      message: "Invitation already accepted",
      statusCode: 409,
    });
  }

  // Verify the accepting user's email matches the invitation
  const userResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
  if (userResult.rows.length === 0 || (userResult.rows[0] as { email: string }).email.toLowerCase() !== invitation.email) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Invitation was issued to a different email address",
      statusCode: 403,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO collaborators (id, collection_id, user_id) VALUES ($1, $2, $3)
       ON CONFLICT (collection_id, user_id) DO NOTHING`,
      [uuidv4(), invitation.collection_id, userId],
    );

    await client.query(
      `UPDATE collection_invitations SET accepted_at = NOW() WHERE id = $1`,
      [invitation.id],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { collectionId: invitation.collection_id };
}

export async function listCollaborators(collectionId: string, userId: string) {
  // Owner or collaborator can list
  const access = await pool.query(
    `SELECT id FROM collections
     WHERE id = $1
       AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [collectionId, userId],
  );

  if (access.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Collection not found",
      statusCode: 404,
    });
  }

  const result = await pool.query(
    `SELECT * FROM collaborators WHERE collection_id = $1 ORDER BY created_at ASC`,
    [collectionId],
  );

  return result.rows.map((r) => formatCollaborator(r as CollaboratorRow));
}

export async function removeCollaborator(collectionId: string, collaboratorUserId: string, ownerId: string): Promise<{ success: true }> {
  await verifyCollectionOwnership(collectionId, ownerId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const removed = await client.query(
      `DELETE FROM collaborators WHERE collection_id = $1 AND user_id = $2 RETURNING id`,
      [collectionId, collaboratorUserId],
    );

    if (removed.rows.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Collaborator not found on this collection",
        statusCode: 404,
      });
    }

    // Unassign tasks where this user was the assignee
    await client.query(
      `UPDATE tasks SET assignee_user_id = NULL, updated_at = NOW()
       WHERE collection_id = $1 AND assignee_user_id = $2`,
      [collectionId, collaboratorUserId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
}

export async function assignTask(taskId: string, assigneeUserId: string | null, requesterUserId: string) {
  const taskResult = await pool.query(
    `SELECT t.id, t.collection_id, t.user_id FROM tasks t
     WHERE t.id = $1
       AND (t.user_id = $2 OR t.collection_id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [taskId, requesterUserId],
  );

  if (taskResult.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Task not found",
      statusCode: 404,
    });
  }

  const task = taskResult.rows[0] as { collection_id: string; user_id: string };

  if (assigneeUserId !== null) {
    // Validate assignee is owner or collaborator
    const isAuthorized = await pool.query(
      `SELECT 1 FROM collections WHERE id = $1 AND user_id = $2
       UNION
       SELECT 1 FROM collaborators WHERE collection_id = $1 AND user_id = $2`,
      [task.collection_id, assigneeUserId],
    );

    if (isAuthorized.rows.length === 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Assignee must be the collection owner or a collaborator",
        statusCode: 400,
        details: [{ field: "assigneeUserId", message: "User is not part of this collection" }],
      });
    }
  }

  await pool.query(
    `UPDATE tasks SET assignee_user_id = $1, updated_at = NOW() WHERE id = $2`,
    [assigneeUserId, taskId],
  );

  return { success: true };
}
