import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentNode } from "../../contracts/document.js";
import { withActor } from "../../middleware/requestContext.js";
import { listActivity } from "../../services/activityService.js";
import { createComment, listComments } from "../../services/commentService.js";
import { documentToPlainText } from "../../services/document/plainText.js";
import { editTaskDocumentBlocks, type DocumentBlockOperation } from "../../services/document/editBlocks.js";
import { getTaskDocument } from "../../services/documentService.js";
import { batchCreateTasks } from "../../services/task/batch.js";
import { claimTask, getTaskClaim, releaseTaskClaim } from "../../services/task/claim.js";
import { getTaskDetail } from "../../services/task/detail.js";
import type { McpAuthContext } from "../../types/mcp.js";
import { formatTaskLine } from "../format.js";
import { assertUuid, resolveCollection, ToolInputError } from "../resolve.js";
import { collectionNameMap, runTool } from "../toolkit.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const taskId = z.string().describe("Task id (the id:... value from a listing)");

export function registerDocumentReadTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "get_task",
    {
      title: "Get task detail",
      description: "Read a task or note in full: ancestors, rich document revision and content, descendant subtasks, active claim and comments.",
      inputSchema: { id: taskId },
      annotations: READ_ONLY,
    },
    ({ id }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(id, "task id");
          const [detail, doc, comments, claim, names] = await Promise.all([
            getTaskDetail(id, ctx.userId),
            getTaskDocument(id, ctx.userId),
            listComments(id, ctx.userId),
            getTaskClaim(id, ctx.userId, ctx.now()),
            collectionNameMap(ctx.userId),
          ]);
          const titleMap = new Map<string, string>(detail.descendants.map((d) => [d.id, d.title]));
          const plain = documentToPlainText(doc.content, titleMap);
          const lines: string[] = [formatTaskLine(detail.task, names)];
          if (detail.ancestors.length > 0) {
            lines.push(`Ancestors: ${detail.ancestors.map((a) => `${a.title} (id:${a.id})`).join(" > ")}`);
          }
          if (claim) {
            lines.push(`Claimed by: ${claim.label} until ${claim.expiresAt}`);
          }
          lines.push(`Document revision:${doc.revision}`);
          if (plain) {
            lines.push(plain);
          }
          if (detail.descendants.length > 0) {
            lines.push("Subtasks:");
            for (const sub of detail.descendants) {
              const indent = "  ".repeat(Math.max(0, sub.depth - detail.task.depth - 1));
              const box = sub.type === "note" ? "-" : sub.isCompleted ? "[x]" : "[ ]";
              lines.push(`${indent}${box} ${sub.title} · id:${sub.id}`);
            }
          }
          if (comments.length > 0) {
            lines.push("Comments:");
            for (const c of comments) {
              lines.push(`- ${c.body} · id:${c.id}`);
            }
          }
          return lines.join("\n");
        }),
      ),
  );

  server.registerTool(
    "get_task_document",
    {
      title: "Get task document",
      description: "Read a task or note's rich document JSON and current revision before editing.",
      inputSchema: { id: taskId },
      annotations: READ_ONLY,
    },
    ({ id }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(id, "task id");
          const [detail, doc] = await Promise.all([
            getTaskDetail(id, ctx.userId),
            getTaskDocument(id, ctx.userId),
          ]);
          const titleMap = new Map<string, string>(detail.descendants.map((d) => [d.id, d.title]));
          const plain = documentToPlainText(doc.content, titleMap);
          return [
            `Task ${detail.task.title} · id:${id} · revision:${doc.revision}`,
            plain ? `Text:\n${plain}` : "Text: (empty)",
            `JSON:\n${JSON.stringify(doc.content)}`,
          ].join("\n\n");
        }),
      ),
  );

  server.registerTool(
    "list_task_comments",
    {
      title: "List task comments",
      description: "List comments on a task oldest first.",
      inputSchema: { task_id: taskId },
      annotations: READ_ONLY,
    },
    ({ task_id }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(task_id, "task id");
          const comments = await listComments(task_id, ctx.userId);
          if (comments.length === 0) return "No comments.";
          return comments.map((c) => `- [${c.createdAt}] ${c.body} · id:${c.id}`).join("\n");
        }),
      ),
  );

  server.registerTool(
    "list_activity",
    {
      title: "List activity",
      description: "Read recent activity events, optionally scoped to one collection, including agent token attribution.",
      inputSchema: {
        collection: z.string().optional().describe("Collection name or id"),
      },
      annotations: READ_ONLY,
    },
    ({ collection }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          const collectionId = collection ? (await resolveCollection(ctx.userId, collection)).id : undefined;
          const { events } = await listActivity(ctx.userId, { collectionId });
          if (events.length === 0) return "No activity.";
          return events
            .map((e) => {
              const who = e.actor.label ? `${e.actor.label} (${e.actor.type})` : e.actor.type;
              return `- [${e.createdAt}] ${who} · ${e.eventType} · ${e.title ?? e.entityId} · id:${e.entityId}`;
            })
            .join("\n");
        }),
      ),
  );
}

export function registerDocumentWriteTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "save_task_document",
    {
      title: "Save or edit task document",
      description:
        "Save or edit a task's rich document with compare-and-swap revision protection. Pass exactly one edit action: content (full doc JSON), append_paragraph, embed_subtask (atomically creates a subtask and embeds its taskReference block), or remove_block (unlinks a taskReference block by block_id).",
      inputSchema: {
        task_id: taskId,
        base_revision: z.number().int().min(0).describe("Expected current revision from get_task_document (0 before the first save)"),
        content: z.record(z.string(), z.unknown()).optional().describe("Full ProseMirror doc JSON to replace the document"),
        append_paragraph: z.string().min(1).max(10_000).optional().describe("Plain text paragraph to append to the document"),
        embed_subtask: z
          .object({
            title: z.string().min(1).max(500),
            block_id: z.string().min(1).max(64),
            parent_task_id: z.string().optional(),
          })
          .optional()
          .describe("Atomically create a child task and append its taskReference block"),
        remove_block: z.string().min(1).max(64).optional().describe("block_id of a taskReference block to unlink from the document"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(args.task_id, "task id");
          const actions = [args.content, args.append_paragraph, args.embed_subtask, args.remove_block].filter((v) => v !== undefined);
          if (actions.length !== 1) {
            throw new ToolInputError("Pass exactly one of: content, append_paragraph, embed_subtask, or remove_block.");
          }

          let operation: DocumentBlockOperation;
          if (args.content !== undefined) {
            operation = { kind: "replace_document", content: args.content as unknown as DocumentNode };
          } else if (args.append_paragraph !== undefined) {
            operation = {
              kind: "append_block",
              block: { type: "paragraph", content: [{ type: "text", text: args.append_paragraph }] },
            };
          } else if (args.embed_subtask !== undefined) {
            if (args.embed_subtask.parent_task_id !== undefined) {
              assertUuid(args.embed_subtask.parent_task_id, "parent task id");
            }
            operation = {
              kind: "embed_subtask",
              title: args.embed_subtask.title,
              blockId: args.embed_subtask.block_id,
              parentTaskId: args.embed_subtask.parent_task_id,
            };
          } else {
            operation = { kind: "remove_block", blockId: args.remove_block! };
          }

          const result = await editTaskDocumentBlocks(args.task_id, ctx.userId, {
            baseRevision: args.base_revision,
            operation,
          });
          const createdNote = result.createdTaskId ? ` · embedded subtask id:${result.createdTaskId}` : "";
          return `Saved document for task:${args.task_id} · revision:${result.document.revision}${createdNote}`;
        }),
      ),
  );

  server.registerTool(
    "add_comment",
    {
      title: "Add comment",
      description: "Post a progress or evidence comment on a task.",
      inputSchema: {
        task_id: taskId,
        body: z.string().min(1).max(15_000),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ task_id, body }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(task_id, "task id");
          const comment = await createComment(task_id, ctx.userId, body);
          return `Added comment id:${comment.id} on task id:${task_id}.`;
        }),
      ),
  );

  server.registerTool(
    "create_tasks_batch",
    {
      title: "Create tasks batch",
      description: "Create 1 to 50 tasks atomically in one transaction. Retries with the same idempotency_key return the existing tasks; a changed payload with the same key conflicts.",
      inputSchema: {
        idempotency_key: z.string().min(1).max(128).describe("Stable client request id for safe retries"),
        collection: z.string().optional().describe("Collection name or id (omit when parent is given)"),
        parent: taskId.optional().describe("Default parent task id for the batch"),
        tasks: z
          .array(
            z.object({
              title: z.string().min(1).max(500),
              notes: z.string().max(10_000).optional(),
              priority: z.number().int().min(1).max(4).optional(),
              type: z.enum(["task", "note", "event"]).optional(),
              parent: taskId.optional(),
            }),
          )
          .min(1)
          .max(50),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          if (args.parent !== undefined && args.collection !== undefined) {
            throw new ToolInputError("Pass either parent or collection.");
          }
          if (args.parent !== undefined) assertUuid(args.parent, "parent task id");
          const collectionId = args.collection ? (await resolveCollection(ctx.userId, args.collection)).id : undefined;
          for (const item of args.tasks) {
            if (item.parent !== undefined) assertUuid(item.parent, "item parent task id");
          }
          const result = await batchCreateTasks(ctx.userId, {
            idempotencyKey: args.idempotency_key,
            collectionId,
            parentTaskId: args.parent,
            tasks: args.tasks.map((item) => ({
              title: item.title,
              description: item.notes,
              priority: item.priority,
              type: item.type,
              parentTaskId: item.parent,
            })),
          });
          const names = await collectionNameMap(ctx.userId);
          const verb = result.deduplicated ? "Deduplicated" : "Created";
          return [
            `${verb} ${result.tasks.length} tasks:`,
            ...result.tasks.map((t) => formatTaskLine(t, names)),
          ].join("\n");
        }),
      ),
  );

  server.registerTool(
    "claim_task",
    {
      title: "Claim task",
      description: "Atomically claim a task for work. Identity is derived from your authenticated token or OAuth grant. Claims expire automatically so a crashed agent never blocks work permanently.",
      inputSchema: {
        id: taskId,
        ttl_minutes: z.number().int().min(1).max(1440).optional().describe("Claim duration in minutes (default 30)"),
        force: z.boolean().optional().describe("Explicitly recover a claim held by another agent"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ id, ttl_minutes, force }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(id, "task id");
          const claim = await claimTask(id, ctx.userId, {
            ttlSeconds: (ttl_minutes ?? 30) * 60,
            force,
            now: ctx.now(),
          });
          return `Claimed task id:${id} as ${claim.label} until ${claim.expiresAt}.`;
        }),
      ),
  );

  server.registerTool(
    "release_task",
    {
      title: "Release task",
      description: "Release an active claim on a task.",
      inputSchema: {
        id: taskId,
        force: z.boolean().optional().describe("Force release a claim held by another agent"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ id, force }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(id, "task id");
          await releaseTaskClaim(id, ctx.userId, { force, now: ctx.now() });
          return `Released claim on task id:${id}.`;
        }),
      ),
  );
}
