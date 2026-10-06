import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "../utils/AppError.js";
import { listCollections } from "../services/collectionService.js";
import { getUserTimezone } from "../services/viewService.js";
import { ToolInputError } from "./resolve.js";

/**
 * Run a tool body and turn expected failures into tool errors the agent can
 * read and correct, rather than transport errors it cannot.
 */
export async function runTool(body: () => Promise<string>): Promise<CallToolResult> {
  try {
    return { content: [{ type: "text", text: await body() }] };
  } catch (err) {
    if (err instanceof ToolInputError) {
      return toolError(err.message);
    }
    if (err instanceof AppError) {
      const details = err.details?.length ? ` ${JSON.stringify(err.details)}` : "";
      return toolError(`${err.code}: ${err.message}${details}`);
    }
    console.error("[mcp] tool failed:", err);
    return toolError("INTERNAL_ERROR: Planner could not complete this request.");
  }
}

function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

export async function collectionNameMap(userId: string): Promise<Map<string, string>> {
  const collections = await listCollections(userId);
  return new Map(collections.map((c) => [c.id, c.name]));
}

export { getUserTimezone };
