import type { Pool, PoolClient } from "pg";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { currentActor } from "../middleware/requestContext.js";
import type { ActivityEntry, ActivityRecord, ActorType, ListActivityOptions } from "../types/activity.js";

interface ActivityRow {
  id: string;
  user_id: string;
  collection_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  before_data: unknown | null;
  after_data: unknown | null;
  created_at: string;
  actor_type: ActorType;
  api_token_id: string | null;
  oauth_grant_id: string | null;
  actor_label: string | null;
  title: string | null;
}

function formatActivity(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    userId: row.user_id,
    collectionId: row.collection_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    eventType: row.event_type,
    beforeData: row.before_data,
    afterData: row.after_data,
    createdAt: row.created_at,
    title: row.title,
    actor: { type: row.actor_type, tokenId: row.api_token_id, grantId: row.oauth_grant_id, label: row.actor_label },
  };
}

/**
 * The one writer for activity_events, so every entry records who acted - the
 * web app, or the API token the current request authenticated with.
 */
export async function recordActivity(db: Pool | PoolClient, record: ActivityRecord): Promise<void> {
  const actor = currentActor();
  await db.query(
    `INSERT INTO activity_events
       (id, user_id, collection_id, entity_type, entity_id, event_type, before_data, after_data,
        actor_type, api_token_id, oauth_grant_id, actor_label)
     VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      record.id ?? null,
      record.userId,
      record.collectionId,
      record.entityType,
      record.entityId,
      record.eventType,
      record.beforeData === undefined ? null : JSON.stringify(record.beforeData),
      record.afterData === undefined ? null : JSON.stringify(record.afterData),
      actor?.type ?? "session",
      actor?.type === "token" ? actor.credentialId : null,
      actor?.type === "oauth" ? actor.credentialId : null,
      actor?.label ?? null,
    ],
  );
}

const PAGE_SIZE = 50;

export async function listActivity(userId: string, options: ListActivityOptions = {}) {
  // If collectionId specified, verify access
  if (options.collectionId) {
    const access = await pool.query(
      `SELECT id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
      [options.collectionId, userId],
    );

    if (access.rows.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Collection not found",
        statusCode: 404,
      });
    }
  }

  if (options.tokenId) {
    const owned = await pool.query("SELECT id FROM api_tokens WHERE id = $1 AND user_id = $2", [options.tokenId, userId]);
    if (owned.rows.length === 0) {
      throw new AppError({ code: "NOT_FOUND", message: "Token not found", statusCode: 404 });
    }
  }

  const conditions: string[] = [
    `(a.user_id = $1 OR a.collection_id IN (
       SELECT user_id_collections.id FROM collections user_id_collections
       WHERE user_id_collections.user_id = $1
       UNION
       SELECT collection_id FROM collaborators WHERE user_id = $1
     ))`,
  ];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  if (options.collectionId) {
    conditions.push(`a.collection_id = $${paramIndex++}`);
    values.push(options.collectionId);
  }

  if (options.tokenId) {
    conditions.push(`a.api_token_id = $${paramIndex++}`);
    values.push(options.tokenId);
  }

  // Only the caller's own agents: a collaborator's tokens are their business.
  if (options.source === "token") {
    conditions.push(`a.actor_type <> 'session' AND a.user_id = $1`);
  }

  if (options.cursor) {
    conditions.push(`a.created_at < $${paramIndex++}`);
    values.push(options.cursor);
  }

  values.push(PAGE_SIZE + 1);

  const result = await pool.query(
    `SELECT a.*, COALESCE(a.after_data->>'title', a.before_data->>'title', t.title) AS title
     FROM activity_events a
     LEFT JOIN tasks t ON a.entity_type = 'task' AND t.id = a.entity_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY a.created_at DESC
     LIMIT $${paramIndex}`,
    values,
  );

  const rows = result.rows as ActivityRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const events = rows.slice(0, PAGE_SIZE).map(formatActivity);
  const nextCursor = hasMore ? events[events.length - 1].createdAt : null;

  return { events, nextCursor };
}
