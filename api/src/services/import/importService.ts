import type { PoolClient } from "pg";
import pool from "../../db/pool.js";
import { AppError } from "../../utils/AppError.js";
import type { TaskRow } from "../../types/task.js";
import type { Mutation } from "../../types/mutation.js";
import type { ImportManifestItem, ImportPreview, ImportResult, ParsedTask, UndoResult } from "../../types/import.js";
import { runMutation } from "../mutationRunner.js";
import { getAccessibleTask } from "../task/access.js";
import { formatTask } from "../task/format.js";
import { taskDeletedEvent, taskEvent } from "../task/events.js";
import { validateDocument } from "../document/validate.js";
import { insertFirstRevision } from "../document/store.js";
import { documentToPlainText } from "../document/plainText.js";
import { buildImport, countTasks, importHash, normalizeImport, resolveBlocks, type NormalizedImport } from "./importBuild.js";

type Db = PoolClient | typeof pool;
const DOING_NAME = /doing|in progress|fazendo|em andamento|andamento/i;

const notFound = (what: string) => new AppError({ code: "NOT_FOUND", message: `${what} not found`, statusCode: 404 });

/** Collection access plus the depth the new card starts at. */
async function destination(db: Db, userId: string, input: NormalizedImport): Promise<number> {
  const access = await db.query(
    `SELECT id FROM collections WHERE id = $1 AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [input.collectionId, userId],
  );
  if (access.rows.length === 0) throw notFound("Collection");
  if (!input.parentTaskId) return 0;
  const parent = await getAccessibleTask(input.parentTaskId, userId, db);
  if (parent.collection_id !== input.collectionId) throw notFound("Parent task");
  return parent.depth + 1;
}

async function liveManifest(db: Db, userId: string, sourcePath: string, lock = false) {
  const result = await db.query<{ id: string; source_hash: string; root_task_id: string | null; items: ImportManifestItem[]; warnings: string[] }>(
    `SELECT id, source_hash, root_task_id, items, warnings FROM import_manifests
     WHERE user_id = $1 AND source_path = $2 AND undone_at IS NULL${lock ? " FOR UPDATE" : ""}`,
    [userId, sourcePath],
  );
  return result.rows[0] ?? null;
}

export async function previewMarkdownImport(userId: string, body: unknown): Promise<ImportPreview> {
  const input = normalizeImport(body);
  const built = buildImport(input, await destination(pool, userId, input));
  const sourceHash = importHash(input);
  const existing = await liveManifest(pool, userId, input.sourcePath);
  const warnings = [...built.warnings];
  if (existing && existing.source_hash !== sourceHash) {
    warnings.push("This source was imported before with different content; undo that import before applying this one");
  }
  return {
    sourcePath: input.sourcePath,
    sourceHash,
    destination: { collectionId: input.collectionId, parentTaskId: input.parentTaskId },
    cards: 1,
    subtasks: countTasks(built.tasks),
    documents: 1,
    completed: countTasks(built.tasks, "done"),
    inProgress: countTasks(built.tasks, "doing"),
    warnings,
    existingManifestId: existing && existing.source_hash === sourceHash ? existing.id : null,
  };
}

async function insertTask(tx: Mutation, userId: string, input: NormalizedImport, fields: { title: string; parentId: string | null; depth: number; done: boolean; statusId: string | null }): Promise<TaskRow> {
  const result = await tx.client.query<TaskRow>(
    `INSERT INTO tasks (user_id, collection_id, parent_task_id, title, depth, is_completed, completed_at, status_id, order_value)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN NOW() END, $7,
       (SELECT COALESCE(MAX(order_value) + 1000, 0) FROM tasks
        WHERE collection_id = $2 AND section_id IS NULL AND parent_task_id IS NOT DISTINCT FROM $3::uuid))
     RETURNING *`,
    [userId, input.collectionId, fields.parentId, fields.title, fields.depth, fields.done, fields.statusId],
  );
  return result.rows[0];
}

export async function applyMarkdownImport(userId: string, body: unknown): Promise<ImportResult> {
  const input = normalizeImport(body);
  const sourceHash = importHash(input);
  return runMutation(async (tx) => {
    const rootDepth = await destination(tx.client, userId, input);
    const existing = await liveManifest(tx.client, userId, input.sourcePath, true);
    if (existing) {
      if (existing.source_hash !== sourceHash) {
        throw new AppError({
          code: "IMPORT_SOURCE_CHANGED",
          message: "This source was imported before with different content; undo that import first",
          statusCode: 409,
          details: [{ manifestId: existing.id }],
        });
      }
      return { manifestId: existing.id, rootTaskId: existing.root_task_id ?? "", taskIds: existing.items.map((item) => item.taskId), warnings: existing.warnings, deduplicated: true };
    }

    const built = buildImport(input, rootDepth);
    const statuses = await tx.client.query<{ id: string; name: string; completion: boolean }>(
      `SELECT s.id, s.name, s.id = c.completion_status_id AS completion FROM task_statuses s
       JOIN collections c ON c.id = s.collection_id WHERE s.collection_id = $1 ORDER BY s.order_value`,
      [input.collectionId],
    );
    const doneStatus = statuses.rows.find((row) => row.completion)?.id ?? null;
    const doingStatus = statuses.rows.find((row) => !row.completion && DOING_NAME.test(row.name))?.id ?? null;
    const warnings = [...built.warnings];
    if (countTasks(built.tasks, "doing") > 0 && !doingStatus) warnings.push("No in-progress status in this collection; [~] items were left open");

    const created: TaskRow[] = [];
    const root = await insertTask(tx, userId, input, { title: input.title, parentId: input.parentTaskId, depth: rootDepth, done: false, statusId: null });
    created.push(root);
    const ids = new Map<string, string>();
    const insertTree = async (tasks: ParsedTask[], parentId: string, depth: number) => {
      for (const task of tasks) {
        const row = await insertTask(tx, userId, input, {
          title: task.title, parentId, depth, done: task.state === "done",
          statusId: task.state === "done" ? doneStatus : task.state === "doing" ? doingStatus : null,
        });
        created.push(row);
        ids.set(task.key, row.id);
        await insertTree(task.children, row.id, depth + 1);
      }
    };
    await insertTree(built.tasks, root.id, rootDepth + 1);

    const content = validateDocument(resolveBlocks(built.blocks, ids));
    await insertFirstRevision(tx.client, root.id, content, userId);
    const titles = new Map(created.map((row) => [row.id, row.title]));
    const description = documentToPlainText(content, titles);
    await tx.client.query("UPDATE tasks SET description = $2 WHERE id = $1", [root.id, description || null]);

    const items: ImportManifestItem[] = created.map((row) => ({ taskId: row.id, role: row.id === root.id ? "root" : "subtask" }));
    const manifest = await tx.client.query<{ id: string }>(
      `INSERT INTO import_manifests (user_id, source_path, source_hash, collection_id, root_task_id, items, sources, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, input.sourcePath, sourceHash, input.collectionId, root.id, JSON.stringify(items), JSON.stringify({ plan: input.plan, task: input.task }), JSON.stringify(warnings)],
    );

    for (const row of created) {
      const task = formatTask(row.id === root.id ? { ...row, description } : row);
      await tx.recordActivity({ userId, collectionId: task.collectionId, entityType: "task", entityId: task.id, eventType: "task_created", afterData: { title: task.title, source: input.sourcePath } });
      tx.emit(taskEvent("created", userId, task));
    }
    return { manifestId: manifest.rows[0].id, rootTaskId: root.id, taskIds: created.map((row) => row.id), warnings, deduplicated: false };
  });
}

/**
 * Remove what an import created, but only where nobody changed it since:
 * an edited, completed, moved, commented or newly parented task stays, and so
 * do its ancestors, because deleting a parent would cascade into it.
 */
export async function undoMarkdownImport(userId: string, manifestId: string): Promise<UndoResult> {
  return runMutation(async (tx) => {
    const found = await tx.client.query<{ id: string; items: ImportManifestItem[]; collection_id: string }>(
      `SELECT id, items, collection_id FROM import_manifests WHERE id = $1 AND user_id = $2 AND undone_at IS NULL FOR UPDATE`,
      [manifestId, userId],
    );
    const manifest = found.rows[0];
    if (!manifest) throw notFound("Import");
    const ids = manifest.items.map((item) => item.taskId);
    const rows = (await tx.client.query<{ id: string; parent_task_id: string | null; title: string; collection_id: string }>(
      "SELECT id, parent_task_id, title, collection_id FROM tasks WHERE id = ANY($1::uuid[]) FOR UPDATE",
      [ids],
    )).rows;
    const changed = await tx.client.query<{ id: string }>(
      `SELECT t.id FROM tasks t WHERE t.id = ANY($1::uuid[]) AND (
         t.updated_at > (SELECT created_at FROM import_manifests WHERE id = $2)
         OR EXISTS (SELECT 1 FROM tasks c WHERE c.parent_task_id = t.id AND NOT (c.id = ANY($1::uuid[])))
         OR EXISTS (SELECT 1 FROM comments m WHERE m.task_id = t.id)
         OR EXISTS (SELECT 1 FROM task_documents d WHERE d.task_id = t.id AND d.revision > 1))`,
      [ids, manifest.id],
    );
    const parentOf = new Map(rows.map((row) => [row.id, row.parent_task_id]));
    const kept = new Set<string>();
    for (const { id } of changed.rows) {
      for (let cursor: string | null | undefined = id; cursor && parentOf.has(cursor) && !kept.has(cursor); cursor = parentOf.get(cursor)) kept.add(cursor);
    }
    const doomed = rows.filter((row) => !kept.has(row.id));
    if (doomed.length > 0) await tx.client.query("DELETE FROM tasks WHERE id = ANY($1::uuid[])", [doomed.map((row) => row.id)]);
    for (const row of doomed) {
      await tx.recordActivity({ userId, collectionId: row.collection_id, entityType: "task", entityId: row.id, eventType: "task_deleted", beforeData: { title: row.title } });
      tx.emit(taskDeletedEvent(userId, row.id, row.collection_id));
    }
    await tx.client.query("UPDATE import_manifests SET undone_at = NOW() WHERE id = $1", [manifest.id]);
    return { manifestId: manifest.id, deleted: doomed.map((row) => row.id), kept: [...kept] };
  });
}
