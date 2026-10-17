import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import { createHabit, listHabits } from "../habitService.js";

let userId: string;

describe("habitService (real PostgreSQL)", () => {
  beforeEach(async () => {
    userId = crypto.randomUUID();
    await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')", [userId, `habit-${userId}@example.com`]);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("returns createdAt on created and listed habits", async () => {
    const created = await createHabit(userId, { name: "Drink water" });
    const [listed] = await listHabits(userId);

    expect(new Date(created.createdAt).getTime()).not.toBeNaN();
    expect(JSON.parse(JSON.stringify(listed)).createdAt).toBe(new Date(created.createdAt).toISOString());
  });
});
