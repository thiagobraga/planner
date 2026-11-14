import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { createTask } from "../taskService.js";

let userId: string;
let collectionId: string;
let sectionId: string;

describe("createTask ordering (real PostgreSQL)", () => {
  beforeEach(async () => {
    userId = crypto.randomUUID();
    collectionId = crypto.randomUUID();
    sectionId = crypto.randomUUID();
    await pool.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')`, [
      userId,
      `order-${userId}@example.com`,
    ]);
    await pool.query(`INSERT INTO collections (id, user_id, name, color) VALUES ($1, $2, 'Work', '#c9483b')`, [
      collectionId,
      userId,
    ]);
    await pool.query(`INSERT INTO sections (id, collection_id, name, order_value) VALUES ($1, $2, 'S', 0)`, [
      sectionId,
      collectionId,
    ]);
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  it("appends a new task after the highest sibling order", async () => {
    const a = await createTask(userId, { title: "A", collectionId, orderValue: 500 });
    const b = await createTask(userId, { title: "B", collectionId, orderValue: 18000 });
    const created = await createTask(userId, { title: "Teste", collectionId });

    expect(a.orderValue).toBe(500);
    expect(b.orderValue).toBe(18000);
    expect(created.orderValue).toBe(19000);
  });

  it("starts an empty list at 0", async () => {
    const first = await createTask(userId, { title: "First", collectionId });
    expect(first.orderValue).toBe(0);
  });

  it("scopes the append to the section", async () => {
    await createTask(userId, { title: "Top level", collectionId, orderValue: 9000 });
    const inSection = await createTask(userId, { title: "In section", collectionId, sectionId });
    expect(inSection.orderValue).toBe(0);
    const next = await createTask(userId, { title: "Next in section", collectionId, sectionId });
    expect(next.orderValue).toBe(1000);
  });

  it("scopes the append to the parent task", async () => {
    const parent = await createTask(userId, { title: "Parent", collectionId, orderValue: 4000 });
    const child1 = await createTask(userId, { title: "Child 1", collectionId, parentTaskId: parent.id });
    const child2 = await createTask(userId, { title: "Child 2", collectionId, parentTaskId: parent.id });
    expect(child1.orderValue).toBe(0);
    expect(child2.orderValue).toBe(1000);
  });
});
