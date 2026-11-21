import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createTask,
  updateTask,
  moveTask,
  completeTask,
  reopenTask,
  deleteTask,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "../../services/taskService.js";
import { getAccessibleTask } from "../../services/task/access.js";
import { formatTask } from "../../services/task/format.js";
import { listSections } from "../../services/sectionService.js";
import type { McpAuthContext, NamedRef } from "../../types/mcp.js";
import { formatTaskLine } from "../format.js";
import {
  assertUuid,
  resolveCollection,
  resolveDue,
  resolveLabels,
  resolveStatus,
  ToolInputError,
  withRecurrenceOptions,
} from "../resolve.js";
import { collectionNameMap, getUserTimezone, runTool } from "../toolkit.js";

const MAX_RESCHEDULE = 100;
const END_OF_LIST = Number.MAX_SAFE_INTEGER;

const DATE_HINT = 'Natural language in the user\'s timezone ("tomorrow", "next friday 3pm", "every monday") or YYYY-MM-DD.';

const taskId = z.string().describe("Task id (the id:... value from a listing)");

const fromCompletion = z
  .boolean()
  .optional()
  .describe("With a repeating due: count the next occurrence from the day the task is completed instead of its scheduled date.");
const until = z
  .string()
  .optional()
  .describe(`With a repeating due: last day an occurrence may fall on. ${DATE_HINT}`);

async function resolveSection(userId: string, collectionId: string, ref: string): Promise<NamedRef> {
  const sections = (await listSections(collectionId, userId)) as NamedRef[];
  const byId = sections.find((s) => s.id === ref);
  if (byId) return byId;
  const matches = sections.filter((s) => s.name.toLowerCase() === ref.trim().toLowerCase());
  if (matches.length === 1) return matches[0]!;
  const available = sections.map((s) => `${s.name} (id:${s.id})`).join(", ") || "none";
  throw new ToolInputError(`No single section named "${ref}" in that collection. Available: ${available}.`);
}

async function describe(ctx: McpAuthContext, task: Parameters<typeof formatTaskLine>[0]): Promise<string> {
  return formatTaskLine(task, await collectionNameMap(ctx.userId));
}

export function registerTaskTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description: "Add a task. With a parent it inherits the parent’s collection and section. Otherwise, without a collection it lands in the Inbox. Collections and labels may be given by name.",
      inputSchema: {
        title: z.string().min(1).max(500),
        notes: z.string().max(10_000).optional(),
        due: z.string().optional().describe(DATE_HINT),
        from_completion: fromCompletion,
        until,
        deadline: z.string().optional().describe(DATE_HINT),
        priority: z.number().int().min(1).max(4).optional().describe("1 is highest, 4 is none"),
        collection: z.string().optional().describe("Collection name or id"),
        parent: taskId.optional().describe("Parent task id. Omit collection when using a parent."),
        labels: z.array(z.string()).max(20).optional().describe("Existing label names or ids"),
        type: z.enum(["task", "note", "event"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      runTool(async () => {
        const timeZone = await getUserTimezone(ctx.userId);
        const input: CreateTaskInput = { title: args.title, description: args.notes, priority: args.priority, type: args.type };
        if (!args.due && (args.from_completion !== undefined || args.until !== undefined)) {
          throw new ToolInputError('from_completion and until need a repeating due such as "every saturday".');
        }
        if (args.due) {
          const options = { fromCompletion: args.from_completion, until: args.until };
          const due = withRecurrenceOptions(resolveDue(args.due, timeZone, ctx.now()), options, timeZone, ctx.now());
          Object.assign(input, { dueDate: due.dueDate, dueTime: due.dueTime, recurrenceRule: due.recurrenceRule });
        }
        if (args.deadline) {
          const deadline = resolveDue(args.deadline, timeZone, ctx.now());
          Object.assign(input, { deadlineDate: deadline.dueDate, deadlineTime: deadline.dueTime });
        }
        if (args.parent !== undefined) {
          if (args.collection !== undefined) throw new ToolInputError("Pass either parent or collection.");
          assertUuid(args.parent, "parent task id");
          input.parentTaskId = args.parent;
        }
        if (args.collection) input.collectionId = (await resolveCollection(ctx.userId, args.collection)).id;
        if (args.labels) input.labelIds = await resolveLabels(ctx.userId, args.labels);

        return `Created ${await describe(ctx, await createTask(ctx.userId, input))}`;
      }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: "Change a task's title, notes, due date, deadline, priority or labels. Pass null to clear due, deadline or notes. labels replaces the whole set. To change status, send it in a separate call with only id and status.",
      inputSchema: {
        id: taskId,
        status: z.string().nullable().optional().describe("Status name or id in the task’s collection. A completion status completes the task and its subtasks. Null clears only the status."),
        title: z.string().min(1).max(500).optional(),
        notes: z.string().max(10_000).nullable().optional(),
        due: z.string().nullable().optional().describe(`${DATE_HINT} null clears it.`),
        from_completion: fromCompletion,
        until,
        deadline: z.string().nullable().optional().describe(`${DATE_HINT} null clears it.`),
        priority: z.number().int().min(1).max(4).optional(),
        labels: z.array(z.string()).max(20).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(async () => {
        assertUuid(args.id, "task id");
        if (args.status !== undefined) {
          const { id, status, ...otherFields } = args;
          if (Object.values(otherFields).some((value) => value !== undefined)) {
            throw new ToolInputError("Send status in a separate update_task call with only id and status.");
          }
          const task = await getAccessibleTask(id, ctx.userId);
          const statusId = status === null ? null : (await resolveStatus(ctx.userId, task.collection_id, status)).id;
          if (task.status_id !== statusId) {
            await moveTask(id, ctx.userId, {
              parentTaskId: null,
              statusId,
              scope: { kind: "status", collectionId: task.collection_id, statusId },
              position: END_OF_LIST,
            }, { preserveParent: true });
          }
          return `Updated ${await describe(ctx, formatTask(await getAccessibleTask(id, ctx.userId)))}`;
        }
        const timeZone = await getUserTimezone(ctx.userId);
        const input: UpdateTaskInput = {};
        if (args.title !== undefined) input.title = args.title;
        if (args.notes !== undefined) input.description = args.notes;
        if (args.priority !== undefined) input.priority = args.priority;
        if (typeof args.due !== "string" && (args.from_completion !== undefined || args.until !== undefined)) {
          throw new ToolInputError('from_completion and until need a repeating due such as "every saturday".');
        }
        if (args.due === null) {
          Object.assign(input, { dueDate: null, dueTime: null, recurrenceRule: null });
        } else if (args.due !== undefined) {
          const options = { fromCompletion: args.from_completion, until: args.until };
          const due = withRecurrenceOptions(resolveDue(args.due, timeZone, ctx.now()), options, timeZone, ctx.now());
          Object.assign(input, { dueDate: due.dueDate, dueTime: due.dueTime, recurrenceRule: due.recurrenceRule });
        }
        if (args.deadline === null) {
          Object.assign(input, { deadlineDate: null, deadlineTime: null });
        } else if (args.deadline !== undefined) {
          const deadline = resolveDue(args.deadline, timeZone, ctx.now());
          Object.assign(input, { deadlineDate: deadline.dueDate, deadlineTime: deadline.dueTime });
        }
        if (args.labels) input.labelIds = await resolveLabels(ctx.userId, args.labels);

        return `Updated ${await describe(ctx, await updateTask(args.id, ctx.userId, input))}`;
      }),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete task",
      description: "Check a task off. A recurring task is completed and its next occurrence is scheduled.",
      inputSchema: { id: taskId },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ id }) =>
      runTool(async () => {
        assertUuid(id, "task id");
        const task = await completeTask(id, ctx.userId);
        const next = task.recurrenceRule ? " The next occurrence was scheduled." : "";
        return `Completed ${await describe(ctx, task)}${next}`;
      }),
  );

  server.registerTool(
    "reopen_task",
    {
      title: "Reopen task",
      description: "Uncheck a completed task.",
      inputSchema: { id: taskId },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ id }) =>
      runTool(async () => {
        assertUuid(id, "task id");
        return `Reopened ${await describe(ctx, await reopenTask(id, ctx.userId))}`;
      }),
  );

  server.registerTool(
    "move_task",
    {
      title: "Move task",
      description: "Move a task to another collection or section, or reparent its whole subtree. Use parent: null to promote it to the top level.",
      inputSchema: {
        id: taskId,
        collection: z.string().optional().describe("Destination collection name or id"),
        section: z.string().nullable().optional().describe("Section name or id in the destination collection; null for no section"),
        parent: taskId.nullable().optional().describe("Parent task id; omit collection and section when setting a parent id."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(async () => {
        assertUuid(args.id, "task id");
        if (args.collection === undefined && args.section === undefined && args.parent === undefined) {
          throw new ToolInputError("Pass a collection, section, or parent.");
        }
        const input: UpdateTaskInput = {};
        let collectionId: string | undefined;
        if (args.collection !== undefined) {
          collectionId = (await resolveCollection(ctx.userId, args.collection)).id;
          input.collectionId = collectionId;
          input.sectionId = null;
        }
        if (args.section === null) {
          input.sectionId = null;
        } else if (args.section !== undefined) {
          if (!collectionId) {
            throw new ToolInputError("Give the collection too when moving into a section, so the section name is unambiguous.");
          }
          input.sectionId = (await resolveSection(ctx.userId, collectionId, args.section)).id;
        }
        if (args.parent !== undefined) {
          if (args.parent !== null) {
            if (args.collection !== undefined || args.section !== undefined) {
              throw new ToolInputError("A parent sets the destination collection and section.");
            }
            assertUuid(args.parent, "parent task id");
          }
          const task = await getAccessibleTask(args.id, ctx.userId);
          const destination = args.parent === null ? task : await getAccessibleTask(args.parent, ctx.userId);
          await moveTask(args.id, ctx.userId, {
            parentTaskId: args.parent,
            collectionId: input.collectionId,
            sectionId: input.sectionId,
            scope: { kind: "collection", collectionId: input.collectionId ?? destination.collection_id },
            position: END_OF_LIST,
          });
          return `Moved ${await describe(ctx, formatTask(await getAccessibleTask(args.id, ctx.userId)))}`;
        }
        return `Moved ${await describe(ctx, await updateTask(args.id, ctx.userId, input))}`;
      }),
  );

  server.registerTool(
    "reschedule_tasks",
    {
      title: "Reschedule tasks",
      description: `Give up to ${MAX_RESCHEDULE} tasks the same new due date, e.g. push everything overdue to tomorrow. Recurrence is kept.`,
      inputSchema: {
        ids: z.array(z.string()).min(1).max(MAX_RESCHEDULE),
        due: z.string().describe(DATE_HINT),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ ids, due }) =>
      runTool(async () => {
        const resolved = resolveDue(due, await getUserTimezone(ctx.userId), ctx.now());
        const lines: string[] = [];
        for (const id of ids) {
          try {
            assertUuid(id, "task id");
            const task = await updateTask(id, ctx.userId, { dueDate: resolved.dueDate, dueTime: resolved.dueTime });
            lines.push(`ok ${task.title} · id:${id}`);
          } catch (err) {
            lines.push(`failed id:${id} · ${(err as Error).message}`);
          }
        }
        const failed = lines.filter((line) => line.startsWith("failed")).length;
        return [`Rescheduled ${ids.length - failed} of ${ids.length} to ${resolved.dueDate}.`, ...lines].join("\n");
      }),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: "Permanently delete a task and its subtasks. Prefer complete_task for finished work.",
      inputSchema: { id: taskId },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ id }) =>
      runTool(async () => {
        assertUuid(id, "task id");
        await deleteTask(id, ctx.userId);
        return `Deleted task id:${id}.`;
      }),
  );
}
