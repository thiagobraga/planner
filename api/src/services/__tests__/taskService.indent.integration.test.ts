import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pool from '../../db/pool.js';
import { redisPubClient } from '../../db/redis.js';
import { moveTask } from '../taskService.js';
import { AppError } from '../../utils/AppError.js';

let userId: string;
let collectionId: string;

async function addTask(title: string, orderValue: number, parentTaskId: string | null = null, depth = 0) {
  const result = await pool.query(
    `INSERT INTO tasks (user_id, collection_id, title, parent_task_id, depth, order_value)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, collectionId, title, parentTaskId, depth, orderValue],
  );
  return result.rows[0].id as string;
}

async function tree() {
  const result = await pool.query(
    `SELECT title, parent_task_id, depth, order_value FROM tasks WHERE user_id = $1 ORDER BY depth, order_value`,
    [userId],
  );
  return result.rows;
}

describe('task indentation move (real PostgreSQL and Redis)', () => {
  beforeAll(async () => {
    await redisPubClient.connect();
  });

  afterAll(async () => {
    await redisPubClient.quit();
  });

  beforeEach(async () => {
    userId = randomUUID();
    collectionId = randomUUID();
    await pool.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')`, [userId, `indent-${userId}@example.com`]);
    await pool.query(`INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Indent', '#c9483b')`, [collectionId, userId]);
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  it('persists parent, sibling order, and descendant depth across indent and unindent', async () => {
    const parent = await addTask('parent', 0);
    const sibling = await addTask('sibling', 1000);
    const child = await addTask('child', 0, sibling, 1);
    const scope = { kind: 'collection' as const, collectionId };

    await moveTask(sibling, userId, { parentTaskId: parent, scope, position: 0 });
    let rows = await tree();
    expect(rows.find((row) => row.title === 'sibling')).toMatchObject({ parent_task_id: parent, depth: 1 });
    expect(rows.find((row) => row.title === 'child')).toMatchObject({ parent_task_id: sibling, depth: 2 });

    await moveTask(sibling, userId, { parentTaskId: null, scope, position: 1 });
    rows = await tree();
    expect(rows.find((row) => row.title === 'sibling')).toMatchObject({ parent_task_id: null, depth: 0 });
    expect(rows.find((row) => row.title === 'child')).toMatchObject({ parent_task_id: sibling, depth: 1 });
    expect(rows.filter((row) => row.depth === 0).map((row) => row.title)).toEqual(['parent', 'sibling']);
    expect((await pool.query(`SELECT parent_task_id, depth FROM tasks WHERE id = $1`, [child])).rows[0]).toMatchObject({ parent_task_id: sibling, depth: 1 });
  });

  it('rejects a move past depth five and leaves the whole tree unchanged', async () => {
    const destination = await addTask('destination', 0);
    let parent = await addTask('branch', 1000);
    const branch = parent;
    for (let depth = 1; depth <= 5; depth++) parent = await addTask(`level-${depth}`, 0, parent, depth);
    const before = await tree();
    await expect(moveTask(branch, userId, {
      parentTaskId: destination, scope: { kind: 'collection', collectionId }, position: 0,
    })).rejects.toBeInstanceOf(AppError);
    expect(await tree()).toEqual(before);
  });

  it('persists a child moved to the next parent without disturbing siblings', async () => {
    const first = await addTask('computer', 1000);
    const second = await addTask('pharmacy', 2000);
    const child = await addTask('medicine', 0, first, 1);
    const existing = await addTask('existing', 1000, second, 1);

    await moveTask(child, userId, {
      parentTaskId: second,
      scope: { kind: 'collection', collectionId },
      position: 0,
    });

    const rows = await tree();
    expect(rows.find((row) => row.title === 'medicine')).toMatchObject({ parent_task_id: second, depth: 1 });
    expect(rows.filter((row) => row.parent_task_id === second).map((row) => row.title)).toEqual(['medicine', 'existing']);
    expect(rows.find((row) => row.title === 'existing')?.parent_task_id).toBe(second);
    expect((await pool.query('SELECT id FROM tasks WHERE id = $1', [existing])).rowCount).toBe(1);
  });
});
