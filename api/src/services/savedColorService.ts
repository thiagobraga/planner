import pool from "../db/pool.js";
import { validateColor } from "../utils/color.js";

// The picker shows a single row of recently used swatches; anything past that is
// noise, so the table is trimmed on every write rather than growing unbounded.
export const SAVED_COLOR_LIMIT = 16;

const LIST_QUERY = `SELECT color FROM user_saved_colors
   WHERE user_id = $1
   ORDER BY created_at DESC
   LIMIT $2`;

export async function listSavedColors(userId: string): Promise<string[]> {
  const result = await pool.query(LIST_QUERY, [userId, SAVED_COLOR_LIMIT]);
  return result.rows.map((row) => (row as { color: string }).color);
}

export async function addSavedColor(userId: string, color: unknown): Promise<string[]> {
  const validated = validateColor(color);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM user_saved_colors WHERE user_id = $1 AND LOWER(color) = LOWER($2)`,
      [userId, validated]
    );

    await client.query(
      `INSERT INTO user_saved_colors (user_id, color) VALUES ($1, $2)`,
      [userId, validated]
    );

    await client.query(
      `DELETE FROM user_saved_colors
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM user_saved_colors
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         )`,
      [userId, SAVED_COLOR_LIMIT]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return listSavedColors(userId);
}
