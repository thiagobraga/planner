import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { validate, type ValidationError } from '../utils/validate.js';
import { buildEvent, publishEvent } from './syncService.js';

function publishCollectionEvent(
  eventType: 'created' | 'updated' | 'deleted',
  entityId: string,
  userId: string,
  payload?: unknown,
) {
  publishEvent(
    buildEvent({
      entityType: 'collection',
      eventType,
      entityId,
      userId,
      collectionId: entityId,
      payload,
    }),
  ).catch((err) => console.error('[sync] publish failed', err));
}

const SUPPORTED_COLORS = [
  'berry_red',
  'red',
  'orange',
  'yellow',
  'olive_green',
  'lime_green',
  'green',
  'mint_green',
  'teal',
  'sky_blue',
  'light_blue',
  'blue',
  'grape',
  'violet',
  'lavender',
  'magenta',
  'salmon',
  'charcoal',
  'grey',
  'taupe',
] as const;

interface CollectionRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_inbox: boolean;
  is_archived: boolean;
  order_value: number;
  created_at: string;
  updated_at: string;
}

function formatCollection(row: CollectionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    parentId: row.parent_id,
    name: row.name,
    color: row.color,
    isInbox: row.is_inbox,
    isArchived: row.is_archived,
    orderValue: row.order_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function verifyCollectionOwnership(collectionId: string, userId: string): Promise<CollectionRow> {
  const result = await pool.query(`SELECT * FROM collections WHERE id = $1 AND user_id = $2`, [
    collectionId,
    userId,
  ]);

  if (result.rows.length === 0) {
    throw new AppError({
      code: 'NOT_FOUND',
      message: 'Collection not found',
      statusCode: 404,
    });
  }

  return result.rows[0] as CollectionRow;
}

async function getCollectionDepth(collectionId: string): Promise<number> {
  const result = await pool.query(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id, 1 AS depth FROM collections WHERE id = $1
       UNION ALL
       SELECT p.id, p.parent_id, a.depth + 1
       FROM collections p
       INNER JOIN ancestors a ON p.id = a.parent_id
     )
     SELECT MAX(depth) AS max_depth FROM ancestors`,
    [collectionId],
  );
  return (result.rows[0]?.max_depth ?? 1) as number;
}

// True if candidateId equals targetId or is one of its descendants - used to block
// reparenting cycles (a collection cannot be moved under itself or its own subtree).
async function isSelfOrDescendant(candidateId: string, targetId: string): Promise<boolean> {
  const result = await pool.query(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM collections WHERE id = $1
       UNION ALL
       SELECT p.id FROM collections p INNER JOIN subtree s ON p.parent_id = s.id
     )
     SELECT 1 FROM subtree WHERE id = $2 LIMIT 1`,
    [targetId, candidateId],
  );
  return result.rows.length > 0;
}

export async function listCollections(userId: string) {
  const result = await pool.query(
    `SELECT p.* FROM collections p
     WHERE p.user_id = $1
        OR p.id IN (SELECT collection_id FROM collaborators WHERE user_id = $1)
     ORDER BY p.order_value ASC, p.created_at ASC`,
    [userId],
  );

  return result.rows.map((row) => formatCollection(row as CollectionRow));
}

export interface CreateCollectionInput {
  name: string;
  color: string;
  parentId?: string | null;
}

export async function createCollection(userId: string, input: CreateCollectionInput) {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.length === 0 || input.name.length > 120) {
    errors.push({ field: 'name', message: 'Name must be between 1 and 120 characters' });
  }

  if (
    !input.color ||
    !SUPPORTED_COLORS.includes(input.color as (typeof SUPPORTED_COLORS)[number])
  ) {
    errors.push({ field: 'color', message: 'Color is not in the supported palette' });
  }

  validate(errors);

  // Check unique name per user
  const duplicateCheck = await pool.query(
    `SELECT id FROM collections WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
    [userId, input.name],
  );

  if (duplicateCheck.rows.length > 0) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'name', message: 'A collection with this name already exists' }],
    });
  }

  // Validate parentId and enforce nesting depth
  if (input.parentId) {
    await verifyCollectionOwnership(input.parentId, userId);
    const parentDepth = await getCollectionDepth(input.parentId);
    if (parentDepth >= 4) {
      throw new AppError({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Maximum collection nesting depth of 4 exceeded',
        statusCode: 400,
      });
    }
  }

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO collections (id, user_id, parent_id, name, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, userId, input.parentId ?? null, input.name, input.color],
  );

  const created = formatCollection(result.rows[0] as CollectionRow);
  publishCollectionEvent('created', created.id, userId, created);
  return created;
}

export interface UpdateCollectionInput {
  name?: string;
  color?: string;
  parentId?: string | null;
  orderValue?: number;
}

export async function updateCollection(collectionId: string, userId: string, input: UpdateCollectionInput) {
  const collection = await verifyCollectionOwnership(collectionId, userId);

  if (collection.is_inbox && input.name !== undefined) {
    throw new AppError({
      code: 'INBOX_PROTECTED',
      message: 'Inbox collection cannot be renamed',
      statusCode: 400,
    });
  }

  const errors: ValidationError[] = [];

  if (input.name !== undefined) {
    if (input.name.length === 0 || input.name.length > 120) {
      errors.push({ field: 'name', message: 'Name must be between 1 and 120 characters' });
    }
  }

  if (input.color !== undefined) {
    if (!SUPPORTED_COLORS.includes(input.color as (typeof SUPPORTED_COLORS)[number])) {
      errors.push({ field: 'color', message: 'Color is not in the supported palette' });
    }
  }

  validate(errors);

  // Check unique name per user (exclude self)
  if (input.name !== undefined) {
    const duplicateCheck = await pool.query(
      `SELECT id FROM collections WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`,
      [userId, input.name, collectionId],
    );

    if (duplicateCheck.rows.length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: [{ field: 'name', message: 'A collection with this name already exists' }],
      });
    }
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

  if (input.parentId !== undefined) {
    if (input.parentId !== null) {
      if (input.parentId === collectionId) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'A collection cannot be its own parent',
          statusCode: 400,
        });
      }
      await verifyCollectionOwnership(input.parentId, userId);
      if (await isSelfOrDescendant(input.parentId, collectionId)) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Cannot move a collection under its own descendant',
          statusCode: 400,
        });
      }
      const parentDepth = await getCollectionDepth(input.parentId);
      if (parentDepth >= 4) {
        throw new AppError({
          code: 'MAX_DEPTH_EXCEEDED',
          message: 'Maximum collection nesting depth of 4 exceeded',
          statusCode: 400,
        });
      }
    }
    setClauses.push(`parent_id = $${paramIndex++}`);
    values.push(input.parentId);
  }

  if (input.orderValue !== undefined) {
    setClauses.push(`order_value = $${paramIndex++}`);
    values.push(input.orderValue);
  }

  if (setClauses.length === 0) {
    return formatCollection(collection);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(collectionId);

  const query = `UPDATE collections SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
  const result = await pool.query(query, values);

  const updated = formatCollection(result.rows[0] as CollectionRow);
  publishCollectionEvent('updated', updated.id, userId, updated);
  return updated;
}

export async function deleteCollection(collectionId: string, userId: string): Promise<{ success: true }> {
  const collection = await verifyCollectionOwnership(collectionId, userId);

  if (collection.is_inbox) {
    throw new AppError({
      code: 'INBOX_PROTECTED',
      message: 'Inbox collection cannot be deleted',
      statusCode: 400,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cascade: delete tasks in this collection (sections cascade via FK)
    await client.query(`DELETE FROM tasks WHERE collection_id = $1`, [collectionId]);

    // Delete sections
    await client.query(`DELETE FROM sections WHERE collection_id = $1`, [collectionId]);

    // Delete the collection itself
    await client.query(`DELETE FROM collections WHERE id = $1`, [collectionId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  publishCollectionEvent('deleted', collectionId, userId);
  return { success: true };
}

export async function archiveCollection(collectionId: string, userId: string) {
  const collection = await verifyCollectionOwnership(collectionId, userId);

  if (collection.is_inbox) {
    throw new AppError({
      code: 'INBOX_PROTECTED',
      message: 'Inbox collection cannot be archived',
      statusCode: 400,
    });
  }

  const result = await pool.query(
    `UPDATE collections SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [collectionId],
  );

  const archived = formatCollection(result.rows[0] as CollectionRow);
  publishCollectionEvent('updated', archived.id, userId, archived);
  return archived;
}
