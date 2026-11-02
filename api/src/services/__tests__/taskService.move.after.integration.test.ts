import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { createTask, moveTask } from "../taskService.js";

let userId: string;
let collectionId: string;

async function orderOf(id: string): Promise<number> {
  const r = await pool.query(`SELECT order_value FROM tasks WHERE id = $1`, [id]);
  return r.rows[0].order_value;
}

describe("moveTask afterTaskId (real PostgreSQL)", () => {
  beforeEach(async () => {
    userId = crypto.randomUUID();
    collectionId = crypto.randomUUID();
    await pool.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')`, [
      userId,
      `after-${userId}@example.com`,
    ]);
    await pool.query(`INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Work', '#c9483b')`, [
      collectionId,
      userId,
    ]);
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const scope = () => ({ kind: "collection" as const, collectionId });

  it("places after the named sibling even when the client position ignores a hidden sibling", async () => {
    await createTask(userId, { title: "A", collectionId, orderValue: 0 });
    await createTask(userId, { title: "B", collectionId, orderValue: 1000 });
    const hidden = await createTask(userId, { title: "Hidden", collectionId, orderValue: 2000 });
    const d = await createTask(userId, { title: "D", collectionId, orderValue: 3000 });
    const x = await createTask(userId, { title: "X", collectionId, orderValue: 9000 });
    await pool.query(`UPDATE tasks SET is_completed = true WHERE id = $1`, [hidden.id]);

    // The client shows A, B, D, so dropping X below D is its position 3. The
    // server counts Hidden too, so index 3 alone lands X between Hidden and D.
    await moveTask(x.id, userId, {
      parentTaskId: null,
      scope: scope(),
      position: 3,
      afterTaskId: d.id,
    });

    expect(await orderOf(x.id)).toBeGreaterThan(await orderOf(d.id));
  });

  it("places at the top when afterTaskId is null", async () => {
    const a = await createTask(userId, { title: "A", collectionId, orderValue: 500 });
    const b = await createTask(userId, { title: "B", collectionId, orderValue: 6000 });
    const x = await createTask(userId, { title: "X", collectionId, orderValue: 9000 });

    await moveTask(x.id, userId, { parentTaskId: null, scope: scope(), position: 0, afterTaskId: null });

    const [ox, oa, ob] = [await orderOf(x.id), await orderOf(a.id), await orderOf(b.id)];
    expect(ox).toBeLessThan(oa);
    expect(oa).toBeLessThan(ob);
  });

  it("rejects an afterTaskId that is not a sibling in the target list", async () => {
    const x = await createTask(userId, { title: "X", collectionId });
    await expect(
      moveTask(x.id, userId, {
        parentTaskId: null,
        scope: scope(),
        position: 0,
        afterTaskId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
