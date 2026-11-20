import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../utils/AppError.js";
import type { DocumentNode, TaskDocumentDto } from "../../contracts/document.js";
import type { TaskRow } from "../../types/task.js";
import { attachLabels } from "../labelService.js";
import { runMutation } from "../mutationRunner.js";
import { getAccessibleTask } from "../task/access.js";
import { taskEvent } from "../task/events.js";
import { formatTask } from "../task/format.js";
import { MAX_DEPTH, validateTaskScalarFields } from "../task/validation.js";
import { documentToPlainText, referencedTaskIds, seedDocument } from "./plainText.js";
import { documentDto, findDocumentRow, insertFirstRevision, seededDto, updateFromRevision } from "./store.js";
import { validateDocument } from "./validate.js";

const BLOCK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type DocumentBlockOperation =
  | { kind: "replace_document"; content: DocumentNode }
  | { kind: "append_block"; block: DocumentNode }
  | { kind: "replace_block"; blockId: string; block: DocumentNode }
  | { kind: "remove_block"; blockId: string }
  | { kind: "embed_subtask"; title: string; blockId: string; parentTaskId?: string | null };

export interface EditDocumentBlocksInput {
  baseRevision: number;
  operation: DocumentBlockOperation;
}

export interface EditDocumentBlocksResult {
  document: TaskDocumentDto;
  createdTaskId?: string;
}

function findReferencedTaskByBlockId(node: DocumentNode, blockId: string): string | null {
  if (node.type === "taskReference" && node.attrs?.blockId === blockId && typeof node.attrs.taskId === "string") {
    return node.attrs.taskId;
  }
  for (const child of node.content ?? []) {
    const found = findReferencedTaskByBlockId(child, blockId);
    if (found) return found;
  }
  return null;
}

function replaceByBlockId(node: DocumentNode, blockId: string, replacement: DocumentNode | null): { node: DocumentNode; found: boolean } {
  if (!node.content) return { node, found: false };
  let found = false;
  const nextContent: DocumentNode[] = [];
  for (const child of node.content) {
    if (child.type === "taskReference" && child.attrs?.blockId === blockId) {
      found = true;
      if (replacement) nextContent.push(replacement);
      continue;
    }
    const sub = replaceByBlockId(child, blockId, replacement);
    if (sub.found) found = true;
    nextContent.push(sub.node);
  }
  return {
    node: { ...node, content: nextContent.length > 0 ? nextContent : [{ type: "paragraph" }] },
    found,
  };
}

function appendBlockToDoc(doc: DocumentNode, block: DocumentNode): DocumentNode {
  const existing = doc.content ?? [];
  const isSingleEmptyParagraph =
    existing.length === 1 &&
    existing[0]?.type === "paragraph" &&
    (!existing[0].content || existing[0].content.length === 0);
  return {
    type: "doc",
    content: isSingleEmptyParagraph ? [block] : [...existing, block],
  };
}

async function referenceTitles(client: PoolClient, content: DocumentNode, collectionId: string): Promise<Map<string, string>> {
  const ids = referencedTaskIds(content);
  if (ids.length === 0) return new Map();
  const result = await client.query<{ id: string; title: string }>(
    "SELECT id, title FROM tasks WHERE id = ANY($1::uuid[]) AND collection_id = $2",
    [ids, collectionId],
  );
  return new Map(result.rows.map((r) => [r.id, r.title]));
}

function conflictError(current: TaskDocumentDto, baseRevision: number): AppError {
  return new AppError({
    code: "DOCUMENT_CONFLICT",
    message: `The document is at revision ${current.revision}, not ${baseRevision}. Merge with the current content and save again from that revision.`,
    statusCode: 409,
    details: [{ current }],
  });
}

export async function editTaskDocumentBlocks(
  taskId: string,
  userId: string,
  input: EditDocumentBlocksInput,
): Promise<EditDocumentBlocksResult> {
  const { baseRevision, operation } = input;
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "baseRevision must be a non-negative integer",
      statusCode: 400,
    });
  }

  if ("blockId" in operation && !BLOCK_ID_RE.test(operation.blockId)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "blockId must be 1-64 letters, digits, _ or -",
      statusCode: 400,
    });
  }

  if (operation.kind === "embed_subtask") {
    validateTaskScalarFields({ title: operation.title, requireTitle: true });
  }

  return runMutation(async (tx) => {
    const owner = await getAccessibleTask(taskId, userId, tx.client, { forUpdate: true });
    const existingRow = await findDocumentRow(tx.client, owner.id);
    const currentDto = existingRow ? documentDto(existingRow) : seededDto(owner);

    // Idempotent retry check for embed_subtask by blockId
    if (operation.kind === "embed_subtask" && existingRow) {
      const alreadyTaskId = findReferencedTaskByBlockId(currentDto.content, operation.blockId);
      if (alreadyTaskId) {
        return { document: currentDto, createdTaskId: alreadyTaskId };
      }
    }

    if (currentDto.revision !== baseRevision) {
      throw conflictError(currentDto, baseRevision);
    }

    let nextContent: DocumentNode;
    let createdTaskId: string | undefined;

    if (operation.kind === "replace_document") {
      nextContent = validateDocument(operation.content);
    } else if (operation.kind === "append_block") {
      nextContent = validateDocument(appendBlockToDoc(currentDto.content, operation.block));
    } else if (operation.kind === "replace_block") {
      const replaced = replaceByBlockId(currentDto.content, operation.blockId, operation.block);
      if (!replaced.found) {
        throw new AppError({
          code: "NOT_FOUND",
          message: `Block "${operation.blockId}" not found in document`,
          statusCode: 404,
        });
      }
      nextContent = validateDocument(replaced.node);
    } else if (operation.kind === "remove_block") {
      const removed = replaceByBlockId(currentDto.content, operation.blockId, null);
      if (!removed.found) {
        throw new AppError({
          code: "NOT_FOUND",
          message: `Block "${operation.blockId}" not found in document`,
          statusCode: 404,
        });
      }
      nextContent = validateDocument(removed.node);
    } else {
      // embed_subtask: for a task owner create its child; for a note owner create a standalone task in the same collection
      let parentId: string | null = null;
      let depth = 0;
      if (owner.type !== "note") {
        const targetParentId = operation.parentTaskId ?? owner.id;
        const parentRow = targetParentId === owner.id ? owner : await getAccessibleTask(targetParentId, userId, tx.client);
        if (parentRow.collection_id !== owner.collection_id) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Embedded subtask must belong to the same collection",
            statusCode: 400,
          });
        }
        parentId = parentRow.id;
        depth = parentRow.depth + 1;
        if (depth > MAX_DEPTH) {
          throw new AppError({
            code: "MAX_DEPTH_EXCEEDED",
            message: "Maximum subtask nesting depth of 5 exceeded",
            statusCode: 400,
          });
        }
      }

      createdTaskId = uuidv4();
      const inserted = await tx.client.query<TaskRow>(
        `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, priority, depth, type, order_value)
         VALUES ($1, $2, $3, $4, $5, $6, 4, $7, 'task',
           (SELECT COALESCE(MAX(order_value) + 1000, 0) FROM tasks
            WHERE collection_id IS NOT DISTINCT FROM $3::uuid
              AND section_id IS NOT DISTINCT FROM $4::uuid
              AND parent_task_id IS NOT DISTINCT FROM $5::uuid))
         RETURNING *`,
        [createdTaskId, userId, owner.collection_id, owner.section_id, parentId, operation.title.trim(), depth],
      );
      const [formattedChild] = await attachLabels([formatTask(inserted.rows[0])], tx.client);
      await tx.recordActivity({
        userId,
        collectionId: formattedChild.collectionId,
        entityType: "task",
        entityId: formattedChild.id,
        eventType: "task_created",
        afterData: { title: formattedChild.title },
      });
      tx.emit(taskEvent("created", userId, formattedChild));

      const refBlock: DocumentNode = {
        type: "taskReference",
        attrs: { taskId: createdTaskId, blockId: operation.blockId },
      };
      const baseDoc = existingRow ? currentDto.content : seedDocument(owner.description);
      nextContent = validateDocument(appendBlockToDoc(baseDoc, refBlock));
    }

    const savedRow =
      baseRevision === 0
        ? await insertFirstRevision(tx.client, owner.id, nextContent, userId)
        : await updateFromRevision(tx.client, owner.id, nextContent, baseRevision, userId);

    if (!savedRow) {
      const latestRow = await findDocumentRow(tx.client, owner.id);
      throw conflictError(latestRow ? documentDto(latestRow) : seededDto(owner), baseRevision);
    }

    const derived = documentToPlainText(nextContent, await referenceTitles(tx.client, nextContent, owner.collection_id));
    const updatedOwner = await tx.client.query<TaskRow>(
      "UPDATE tasks SET description = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
      [owner.id, derived === "" ? null : derived],
    );
    const [formattedOwner] = await attachLabels([formatTask(updatedOwner.rows[0])], tx.client);
    const document = documentDto(savedRow);

    await tx.recordActivity({
      userId,
      collectionId: formattedOwner.collectionId,
      entityType: "task",
      entityId: owner.id,
      eventType: "task_updated",
      afterData: { title: formattedOwner.title, fields: ["document"], revision: document.revision },
    });
    tx.emit(taskEvent("updated", userId, formattedOwner));

    return { document, ...(createdTaskId ? { createdTaskId } : {}) };
  });
}
