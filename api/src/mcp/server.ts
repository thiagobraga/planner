import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BUILD_VERSION } from "../utils/buildInfo.js";
import type { McpAuthContext } from "../types/mcp.js";
import { registerViewTools } from "./tools/views.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerHabitReadTools, registerHabitWriteTools } from "./tools/habits.js";
import { registerTaskTools } from "./tools/tasks.js";

const INSTRUCTIONS = [
  "Planner is the user's task manager (a bullet journal).",
  "Tasks live in collections (projects); the Inbox collection holds unsorted tasks. Collections may have sections. Tasks may carry labels and a priority (p1 highest, p4 none).",
  "Dates are resolved by Planner in the user's own timezone, so pass phrases like \"tomorrow\" or \"next friday 3pm\" as-is instead of computing dates yourself.",
  "Every listing ends each line with id:<uuid>; pass that id to tools that act on a task.",
  "Use list_collections before filing a task into a specific collection.",
].join(" ");

/**
 * One server per request: tools are bound to the caller, and a read-only
 * token never even sees the write tools.
 */
export function buildMcpServer(ctx: McpAuthContext): McpServer {
  const server = new McpServer({ name: "planner", version: BUILD_VERSION }, { instructions: INSTRUCTIONS });

  registerViewTools(server, ctx);
  registerCollectionTools(server, ctx);
  registerHabitReadTools(server, ctx);

  if (ctx.scopes.includes("write")) {
    registerTaskTools(server, ctx);
    registerHabitWriteTools(server, ctx);
  }

  return server;
}
