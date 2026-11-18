import { describe, expect, it } from 'vitest';
import pool from '../db/pool.js';
import { createTestUserWithCollection } from './fixtures.js';

describe('integration fixtures', () => {
  it('seeds a user and collection, then removes both', async () => {
    const fixture = await createTestUserWithCollection();
    try {
      const result = await pool.query(
        'SELECT u.id AS user_id, c.id AS collection_id FROM users u JOIN collections c ON c.user_id = u.id WHERE u.id = $1',
        [fixture.userId],
      );
      expect(result.rows).toEqual([{ user_id: fixture.userId, collection_id: fixture.collectionId }]);
    } finally {
      await fixture.cleanup();
    }
    const remaining = await pool.query('SELECT id FROM users WHERE id = $1', [fixture.userId]);
    expect(remaining.rows).toHaveLength(0);
  });
});
