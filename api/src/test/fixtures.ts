import { randomUUID } from 'node:crypto';
import pool from '../db/pool.js';

export async function createTestUserWithCollection() {
  const userId = randomUUID();
  const email = `fixture-${userId}@example.com`;
  await pool.query(
    "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, 'test-only', 'Fixture user')",
    [userId, email],
  );
  try {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO collections (user_id, name, color) VALUES ($1, 'Fixture collection', '#c9483b') RETURNING id",
      [userId],
    );
    const collectionId = result.rows[0].id;
    return {
      userId,
      collectionId,
      cleanup: async () => {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      },
    };
  } catch (error) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    throw error;
  }
}
