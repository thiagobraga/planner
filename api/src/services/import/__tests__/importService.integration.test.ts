import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import pool from "../../../db/pool.js";
import { redisClient, redisPubClient } from "../../../db/redis.js";
import { createTestUserWithCollection } from "../../../test/fixtures.js";
import { applyMarkdownImport, previewMarkdownImport, undoMarkdownImport } from "../importService.js";
import type { MarkdownImportInput } from "../../../types/import.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;

let owner: Fixture;
let stranger: Fixture;

const PLAN = [
  "# Goal",
  "Ship the importer.",
  "- [x] Parser",
  "- [ ] Service",
  "  - [~] Manifest",
  "## Notes",
  "Keep `bytes`.",
].join("\n");

const input = (overrides: Partial<MarkdownImportInput> = {}): MarkdownImportInput => ({
  sourcePath: ".specs/2026-11-20-demo",
  title: "Demo spec",
  plan: PLAN,
  task: "1. [ ] Wire routes",
  collectionId: owner.collectionId,
  ...overrides,
});

async function taskRows(collectionId = owner.collectionId) {
  const result = await pool.query(
    "SELECT id, title, parent_task_id, is_completed, status_id, depth FROM tasks WHERE collection_id = $1 ORDER BY depth, order_value",
    [collectionId],
  );
  return result.rows;
}

beforeEach(async () => {
  for (const client of [redisClient, redisPubClient]) if (!client.isOpen) await client.connect();
  owner = await createTestUserWithCollection();
  stranger = await createTestUserWithCollection();
  await pool.query(
    `WITH s AS (
       INSERT INTO task_statuses (collection_id, name, order_value) VALUES ($1, 'A fazer', 0), ($1, 'Fazendo', 1), ($1, 'Concluído', 2) RETURNING id, name
     ) UPDATE collections SET completion_status_id = (SELECT id FROM s WHERE name = 'Concluído') WHERE id = $1`,
    [owner.collectionId],
  );
});

afterEach(async () => {
  await owner.cleanup();
  await stranger.cleanup();
});

afterAll(async () => {
  await Promise.all([redisClient, redisPubClient].map((client) => (client.isOpen ? client.quit() : undefined)));
  await pool.end();
});

describe("Markdown import", () => {
  it("previews counts and warnings without writing anything", async () => {
    const preview = await previewMarkdownImport(owner.userId, input({ plan: `${PLAN}\n| a | b |` }));
    expect(preview).toMatchObject({ cards: 1, subtasks: 3, documents: 1, completed: 1, inProgress: 1, existingManifestId: null });
    expect(preview.warnings).toContain("Table kept as plain text lines");
    expect(await taskRows()).toEqual([]);
  });

  it("creates one parent card whose description embeds real subtasks at their original places", async () => {
    const result = await applyMarkdownImport(owner.userId, input());
    const rows = await taskRows();
    const root = rows.find((row) => row.id === result.rootTaskId)!;
    expect(root).toMatchObject({ title: "Demo spec", parent_task_id: null });
    const byTitle = Object.fromEntries(rows.map((row) => [row.title, row]));
    expect(byTitle.Parser).toMatchObject({ parent_task_id: root.id, is_completed: true });
    expect(byTitle.Manifest.parent_task_id).toBe(byTitle.Service.id);
    expect(byTitle.Manifest.status_id).not.toBeNull();
    expect(byTitle["1. [ ] Wire routes"]).toBeUndefined();

    const doc = await pool.query("SELECT content, revision FROM task_documents WHERE task_id = $1", [root.id]);
    const blocks = doc.rows[0].content.content as { type: string; attrs?: { taskId?: string } }[];
    expect(blocks.map((block) => block.type)).toEqual([
      "heading", "paragraph", "taskReference", "taskReference", "heading", "paragraph", "heading", "orderedList",
    ]);
    expect(blocks[2].attrs?.taskId).toBe(byTitle.Parser.id);
    const description = await pool.query("SELECT description FROM tasks WHERE id = $1", [root.id]);
    expect(description.rows[0].description).toContain("Ship the importer.");

    const manifest = await pool.query("SELECT sources, items FROM import_manifests WHERE id = $1", [result.manifestId]);
    expect(manifest.rows[0].sources).toEqual({ plan: PLAN, task: "1. [ ] Wire routes" });
    expect(manifest.rows[0].items).toHaveLength(4);
  });

  it("returns the earlier result for an identical retry and refuses a changed source on the same path", async () => {
    const first = await applyMarkdownImport(owner.userId, input());
    const again = await applyMarkdownImport(owner.userId, input());
    expect(again).toMatchObject({ manifestId: first.manifestId, rootTaskId: first.rootTaskId, deduplicated: true });
    expect(await taskRows()).toHaveLength(4);

    await expect(applyMarkdownImport(owner.userId, input({ plan: `${PLAN}\nMore.` }))).rejects.toMatchObject({
      code: "IMPORT_SOURCE_CHANGED",
      statusCode: 409,
    });
    expect((await previewMarkdownImport(owner.userId, input())).existingManifestId).toBe(first.manifestId);
  });

  it("undo removes only what the import created and is still unchanged", async () => {
    const result = await applyMarkdownImport(owner.userId, input());
    const service = (await taskRows()).find((row) => row.title === "Service")!;
    await pool.query("UPDATE tasks SET title = 'Service (edited)', updated_at = NOW() + interval '1 second' WHERE id = $1", [service.id]);

    const undo = await undoMarkdownImport(owner.userId, result.manifestId);
    const left = (await taskRows()).map((row) => row.title).sort();
    expect(left).toEqual(["Demo spec", "Service (edited)"]);
    expect(undo.kept.sort()).toEqual([result.rootTaskId, service.id].sort());
    expect(undo.deleted).toHaveLength(2);

    const again = await applyMarkdownImport(owner.userId, input());
    expect(again.deduplicated).toBe(false);
  });

  it("keeps an imported task that someone gave a new child", async () => {
    const result = await applyMarkdownImport(owner.userId, input());
    const parser = (await taskRows()).find((row) => row.title === "Parser")!;
    await pool.query(
      "INSERT INTO tasks (user_id, collection_id, parent_task_id, title, depth, order_value) VALUES ($1, $2, $3, 'Mine', 2, 0)",
      [owner.userId, owner.collectionId, parser.id],
    );
    const undo = await undoMarkdownImport(owner.userId, result.manifestId);
    expect(undo.kept).toContain(parser.id);
    expect((await taskRows()).map((row) => row.title)).toContain("Mine");
  });

  it("files every task in a status so opening the board does not touch them and undo stays complete", async () => {
    const result = await applyMarkdownImport(owner.userId, input());
    const unfiled = await pool.query("SELECT title FROM tasks WHERE collection_id = $1 AND status_id IS NULL", [owner.collectionId]);
    expect(unfiled.rows).toEqual([]);
    const undo = await undoMarkdownImport(owner.userId, result.manifestId);
    expect(undo.kept).toEqual([]);
  });

  it("never imports into or undoes from someone else's collection", async () => {
    await expect(applyMarkdownImport(stranger.userId, input())).rejects.toMatchObject({ statusCode: 404 });
    const result = await applyMarkdownImport(owner.userId, input());
    await expect(undoMarkdownImport(stranger.userId, result.manifestId)).rejects.toMatchObject({ statusCode: 404 });
  });
});
