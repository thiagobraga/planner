import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import pool from "../pool.js";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations/053_task_documents.sql");
const sql = () => fs.readFileSync(FILE, "utf-8");

describe("053_task_documents", () => {
  it("is additive so the previous color keeps running on the new schema", () => {
    const statements = sql().split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) expect(statement).toMatch(/^CREATE (TABLE|INDEX)\b/i);
  });

  // Applied in a throwaway schema inside a rolled-back transaction, so the
  // shared test database and parallel suites are never locked or changed.
  it("applies on a database that already holds tasks and leaves them untouched", async () => {
    const client = await pool.connect();
    const schema = `mig053_${crypto.randomUUID().replace(/-/g, "")}`;
    try {
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path = ${schema}, public`);
      await client.query("CREATE TABLE users (id UUID PRIMARY KEY)");
      await client.query("CREATE TABLE tasks (id UUID PRIMARY KEY, title TEXT NOT NULL, description TEXT)");
      const userId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      await client.query("INSERT INTO users (id) VALUES ($1)", [userId]);
      await client.query("INSERT INTO tasks VALUES ($1, 'Existing', 'Plain notes')", [taskId]);

      await client.query(sql());

      const tasks = await client.query("SELECT title, description FROM tasks");
      expect(tasks.rows).toEqual([{ title: "Existing", description: "Plain notes" }]);

      const inserted = await client.query(
        `INSERT INTO task_documents (task_id, content, updated_by) VALUES ($1, '{"type":"doc"}', $2)
         RETURNING revision, schema_version`,
        [taskId, userId],
      );
      expect(inserted.rows[0]).toEqual({ revision: "1", schema_version: 1 });

      await client.query("SAVEPOINT dup");
      await expect(
        client.query(`INSERT INTO task_documents (task_id, content) VALUES ($1, '{}')`, [taskId]),
      ).rejects.toMatchObject({ code: "23505" });
      await client.query("ROLLBACK TO SAVEPOINT dup");

      await client.query("SAVEPOINT rev_check");
      await expect(
        client.query(`UPDATE task_documents SET revision = 0 WHERE task_id = $1`, [taskId]),
      ).rejects.toMatchObject({ code: "23514" });
      await client.query("ROLLBACK TO SAVEPOINT rev_check");

      await client.query("SAVEPOINT schema_check");
      await expect(
        client.query(`UPDATE task_documents SET schema_version = 0 WHERE task_id = $1`, [taskId]),
      ).rejects.toMatchObject({ code: "23514" });
      await client.query("ROLLBACK TO SAVEPOINT schema_check");

      await client.query("DELETE FROM users WHERE id = $1", [userId]);
      const kept = await client.query("SELECT updated_by FROM task_documents");
      expect(kept.rows).toEqual([{ updated_by: null }]);

      await client.query("DELETE FROM tasks WHERE id = $1", [taskId]);
      expect((await client.query("SELECT count(*)::int AS n FROM task_documents")).rows[0].n).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
