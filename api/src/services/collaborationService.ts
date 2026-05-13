import { v4 as uuidv4 } from "uuid";
import { createHash, randomBytes } from "crypto";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface InvitationRow {
  id: string;
  project_id: string;
  email: string;
  token_hash: string;
  accepted_at: string | null;
  created_at: string;
}

interface CollaboratorRow {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

function formatInvitation(row: InvitationRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    email: row.email,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function formatCollaborator(row: CollaboratorRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyProjectOwnership(projectId: string, userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only the project owner can perform this action",
      statusCode: 403,
    });
  }
}

export async function inviteToProject(projectId: string, ownerId: string, email: string) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "email", message: "Invalid email format" }],
    });
  }

  await verifyProjectOwnership(projectId, ownerId);

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const id = uuidv4();

  const result = await pool.query(
    `INSERT INTO project_invitations (id, project_id, email, token_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, projectId, email.toLowerCase(), tokenHash],
  );

  return { invitation: formatInvitation(result.rows[0] as InvitationRow), token };
}

export async function acceptInvitation(token: string, userId: string) {
  const tokenHash = hashToken(token);

  const inviteResult = await pool.query(
    `SELECT * FROM project_invitations WHERE token_hash = $1`,
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
      `INSERT INTO collaborators (id, project_id, user_id) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [uuidv4(), invitation.project_id, userId],
    );

    await client.query(
      `UPDATE project_invitations SET accepted_at = NOW() WHERE id = $1`,
      [invitation.id],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { projectId: invitation.project_id };
}

export async function listCollaborators(projectId: string, userId: string) {
  // Owner or collaborator can list
  const access = await pool.query(
    `SELECT id FROM projects
     WHERE id = $1
       AND (user_id = $2 OR id IN (SELECT project_id FROM collaborators WHERE user_id = $2))`,
    [projectId, userId],
  );

  if (access.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Project not found",
      statusCode: 404,
    });
  }

  const result = await pool.query(
    `SELECT * FROM collaborators WHERE project_id = $1 ORDER BY created_at ASC`,
    [projectId],
  );

  return result.rows.map((r) => formatCollaborator(r as CollaboratorRow));
}

export async function removeCollaborator(projectId: string, collaboratorUserId: string, ownerId: string): Promise<{ success: true }> {
  await verifyProjectOwnership(projectId, ownerId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const removed = await client.query(
      `DELETE FROM collaborators WHERE project_id = $1 AND user_id = $2 RETURNING id`,
      [projectId, collaboratorUserId],
    );

    if (removed.rows.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Collaborator not found on this project",
        statusCode: 404,
      });
    }

    // Unassign tasks where this user was the assignee
    await client.query(
      `UPDATE tasks SET assignee_user_id = NULL, updated_at = NOW()
       WHERE project_id = $1 AND assignee_user_id = $2`,
      [projectId, collaboratorUserId],
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
    `SELECT t.id, t.project_id, t.user_id FROM tasks t
     WHERE t.id = $1
       AND (t.user_id = $2 OR t.project_id IN (SELECT project_id FROM collaborators WHERE user_id = $2))`,
    [taskId, requesterUserId],
  );

  if (taskResult.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Task not found",
      statusCode: 404,
    });
  }

  const task = taskResult.rows[0] as { project_id: string; user_id: string };

  if (assigneeUserId !== null) {
    // Validate assignee is owner or collaborator
    const isAuthorized = await pool.query(
      `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2
       UNION
       SELECT 1 FROM collaborators WHERE project_id = $1 AND user_id = $2`,
      [task.project_id, assigneeUserId],
    );

    if (isAuthorized.rows.length === 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Assignee must be the project owner or a collaborator",
        statusCode: 400,
        details: [{ field: "assigneeUserId", message: "User is not part of this project" }],
      });
    }
  }

  await pool.query(
    `UPDATE tasks SET assignee_user_id = $1, updated_at = NOW() WHERE id = $2`,
    [assigneeUserId, taskId],
  );

  return { success: true };
}
