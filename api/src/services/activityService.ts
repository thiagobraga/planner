import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

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
}

function formatActivity(row: ActivityRow) {
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
  };
}

const PAGE_SIZE = 50;

export interface ListActivityOptions {
  cursor?: string; // ISO timestamp; return events strictly before this
  collectionId?: string;
}

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

  if (options.cursor) {
    conditions.push(`a.created_at < $${paramIndex++}`);
    values.push(options.cursor);
  }

  values.push(PAGE_SIZE + 1);

  const result = await pool.query(
    `SELECT a.* FROM activity_events a
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
