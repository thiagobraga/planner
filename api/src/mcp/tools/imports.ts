import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withActor } from "../../middleware/requestContext.js";
import { applyMarkdownImport, previewMarkdownImport, undoMarkdownImport } from "../../services/import/importService.js";
import type { McpAuthContext } from "../../types/mcp.js";
import { assertUuid, resolveCollection } from "../resolve.js";
import { runTool } from "../toolkit.js";

export function registerImportTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "import_markdown",
    {
      title: "Import a Markdown plan",
      description:
        "Turn one spec folder into one parent task: plan.md becomes its rich description, task.md is kept under its own heading, and checklist items ([ ], [x], [~]) become real subtasks embedded where they were. Run with dry_run true first and show the counts and warnings. Retrying the same source returns the earlier import; a changed source must be undone first.",
      inputSchema: {
        source_path: z.string().describe("Source identity, e.g. .specs/2026-11-15-guest-mode"),
        title: z.string().describe("Title of the parent task"),
        plan: z.string().describe("plan.md text"),
        task: z.string().optional().describe("task.md text, if any"),
        collection: z.string().describe("Destination collection name or id"),
        parent_task_id: z.string().optional().describe("Optional parent task id in that collection"),
        checklists: z.enum(["tasks", "text"]).optional().describe("tasks (default) makes subtasks; text keeps checklists as prose"),
        dry_run: z.boolean().optional().describe("Preview only; nothing is written"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          const collection = await resolveCollection(ctx.userId, args.collection);
          if (args.parent_task_id) assertUuid(args.parent_task_id, "parent task id");
          const body = {
            sourcePath: args.source_path,
            title: args.title,
            plan: args.plan,
            task: args.task ?? null,
            collectionId: collection.id,
            parentTaskId: args.parent_task_id ?? null,
            checklists: args.checklists,
          };
          if (args.dry_run) {
            const p = await previewMarkdownImport(ctx.userId, body);
            return [
              `Dry run for ${p.sourcePath} into ${collection.name}: ${p.cards} card, ${p.subtasks} subtasks (${p.completed} done, ${p.inProgress} in progress), ${p.documents} document.`,
              p.existingManifestId ? `Already imported as manifest:${p.existingManifestId}; applying returns it.` : "Not imported yet.",
              ...p.warnings.map((w) => `Warning: ${w}`),
            ].join("\n");
          }
          const r = await applyMarkdownImport(ctx.userId, body);
          return [
            `${r.deduplicated ? "Already imported" : "Imported"}: parent id:${r.rootTaskId}, ${r.taskIds.length - 1} subtasks, manifest:${r.manifestId}`,
            ...r.warnings.map((w) => `Warning: ${w}`),
          ].join("\n");
        }),
      ),
  );

  server.registerTool(
    "undo_import",
    {
      title: "Undo a Markdown import",
      description: "Remove what an import created. Tasks changed since the import (edited, completed, moved, commented or given new subtasks) and their parents are kept and listed.",
      inputSchema: { manifest_id: z.string().describe("The manifest:... id an import returned") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    ({ manifest_id }) =>
      runTool(() =>
        withActor(ctx.actor, async () => {
          assertUuid(manifest_id, "manifest id");
          const r = await undoMarkdownImport(ctx.userId, manifest_id);
          return `Undone manifest:${r.manifestId}: deleted ${r.deleted.length}, kept ${r.kept.length}${r.kept.length ? ` (${r.kept.map((id) => `id:${id}`).join(", ")})` : ""}`;
        }),
      ),
  );
}
