import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface SectionRow {
  id: string;
  collection_id: string;
  name: string;
  order_value: number;
  created_at: string;
  updated_at: string;
}

function formatSection(row: SectionRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    orderValue: row.order_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function verifyCollectionAccess(collectionId: string, userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM collections
     WHERE id = $1
       AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [collectionId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Collection not found or not accessible",
      statusCode: 404,
    });
  }
}

async function verifySectionAccess(sectionId: string, userId: string): Promise<SectionRow> {
  const result = await pool.query(
    `SELECT s.* FROM sections s
     INNER JOIN collections p ON s.collection_id = p.id
     WHERE s.id = $1
       AND (p.user_id = $2 OR p.id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [sectionId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Section not found or not accessible",
      statusCode: 404,
    });
  }

  return result.rows[0] as SectionRow;
}

export async function listSections(collectionId: string, userId: string) {
  await verifyCollectionAccess(collectionId, userId);

  const result = await pool.query(
    `SELECT * FROM sections WHERE collection_id = $1 ORDER BY order_value ASC`,
    [collectionId]
  );

  return result.rows.map((row) => formatSection(row as SectionRow));
}

export interface CreateSectionInput {
  name: string;
}

export async function createSection(collectionId: string, userId: string, input: CreateSectionInput) {
  // Validate name (1-120 chars)
  if (!input.name || input.name.length === 0 || input.name.length > 120) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: [{ field: "name", message: "Name must be between 1 and 120 characters" }],
    });
  }

  await verifyCollectionAccess(collectionId, userId);

  // Get next order_value
  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(order_value), -1) + 1 AS next_order FROM sections WHERE collection_id = $1`,
    [collectionId]
  );
  const orderValue = maxOrder.rows[0].next_order;

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO sections (id, collection_id, name, order_value)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, collectionId, input.name, orderValue]
  );

  return formatSection(result.rows[0] as SectionRow);
}

export interface UpdateSectionInput {
  name?: string;
  position?: number;
}

export async function updateSection(sectionId: string, userId: string, input: UpdateSectionInput) {
  // Validate name if provided
  if (input.name !== undefined) {
    if (input.name.length === 0 || input.name.length > 120) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        statusCode: 400,
        details: [{ field: "name", message: "Name must be between 1 and 120 characters" }],
      });
    }
  }

  // Validate position if provided
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

  const section = await verifySectionAccess(sectionId, userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update name if provided
    if (input.name !== undefined) {
      await client.query(
        `UPDATE sections SET name = $1, updated_at = NOW() WHERE id = $2`,
        [input.name, sectionId]
      );
    }

    // Reorder if position provided
    if (input.position !== undefined) {
      const siblingsResult = await client.query(
        `SELECT id, order_value FROM sections
         WHERE collection_id = $1 AND id != $2
         ORDER BY order_value ASC`,
        [section.collection_id, sectionId]
      );

      const siblings = siblingsResult.rows as { id: string; order_value: number }[];
      const clampedPosition = Math.min(input.position, siblings.length);

      siblings.splice(clampedPosition, 0, { id: sectionId, order_value: 0 });

      for (let i = 0; i < siblings.length; i++) {
        const newOrderValue = i * 1000;
        await client.query(
          `UPDATE sections SET order_value = $1, updated_at = NOW() WHERE id = $2`,
          [newOrderValue, siblings[i].id]
        );
      }
    }

    await client.query("COMMIT");

    const updated = await pool.query("SELECT * FROM sections WHERE id = $1", [sectionId]);
    return formatSection(updated.rows[0] as SectionRow);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteSection(sectionId: string, userId: string): Promise<{ success: true }> {
  // Verify section exists and user has access
  const section = await verifySectionAccess(sectionId, userId);

  // Restrict deletion to collection owner only
  const ownerCheck = await pool.query(
    `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
    [section.collection_id, userId]
  );

  if (ownerCheck.rows.length === 0) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only the collection owner can delete sections",
      statusCode: 403,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Move all tasks in this section to parent collection (section_id = null)
    await client.query(
      `UPDATE tasks SET section_id = NULL, updated_at = NOW() WHERE section_id = $1`,
      [sectionId]
    );

    // Delete the section
    await client.query(`DELETE FROM sections WHERE id = $1`, [sectionId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
}
