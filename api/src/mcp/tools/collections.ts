import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listCollections } from "../../services/collectionService.js";
import { listLabels } from "../../services/labelService.js";
import type { McpAuthContext } from "../../types/mcp.js";
import { listStatuses } from "../../services/statusService.js";
import { resolveCollection } from "../resolve.js";
import { runTool } from "../toolkit.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerCollectionTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "list_collections",
    {
      title: "Collections",
      description: "The user's collections (projects) and ones shared with them, with ids. Call before filing a task somewhere specific.",
      annotations: READ_ONLY,
    },
    () =>
      runTool(async () => {
        const collections = (await listCollections(ctx.userId)).filter((c) => !c.isArchived);
        const names = new Map(collections.map((c) => [c.id, c.name]));
        return collections
          .map((c) => {
            const notes = [
              c.isInbox ? "inbox" : null,
              c.parentId && names.has(c.parentId) ? `inside ${names.get(c.parentId)}` : null,
              c.userId !== ctx.userId ? "shared with you" : null,
            ].filter(Boolean);
            return `- ${c.name}${notes.length ? ` (${notes.join(", ")})` : ""} · id:${c.id}`;
          })
          .join("\n");
      }),
  );

  server.registerTool(
    "list_statuses",
    {
      title: "Collection statuses",
      description: "List the existing task statuses in a collection, in board order.",
      inputSchema: { collection: z.string().describe("Collection name or id") },
      annotations: READ_ONLY,
    },
    ({ collection }) =>
      runTool(async () => {
        const { id } = await resolveCollection(ctx.userId, collection);
        const statuses = await listStatuses(id, ctx.userId);
        return statuses.length === 0 ? "No statuses." : statuses.map((status) => `- ${status.name} · id:${status.id}`).join("\n");
      }),
  );

  server.registerTool(
    "list_labels",
    {
      title: "Labels",
      description: "The user's labels with ids.",
      annotations: READ_ONLY,
    },
    () =>
      runTool(async () => {
        const labels = await listLabels(ctx.userId);
        return labels.length === 0 ? "No labels." : labels.map((l) => `- ${l.name} · id:${l.id}`).join("\n");
      }),
  );
}
