import crypto from "node:crypto";
import type { DocumentNode } from "../../contracts/document.js";
import type { MarkdownImportInput, ParsedTask } from "../../types/import.js";
import { MAX_DEPTH, validationError } from "../task/validation.js";
import { UUID_RE } from "../document/schema.js";
import { parseMarkdown } from "./markdownParse.js";

const MAX_SOURCE_CHARS = 200_000;
const MAX_IMPORT_TASKS = 200;
export const TASK_SECTION_TITLE = "Tasks (task.md)";

export interface NormalizedImport {
  sourcePath: string;
  title: string;
  plan: string;
  task: string | null;
  collectionId: string;
  parentTaskId: string | null;
  checklists: "tasks" | "text";
}

/** Boundary validation: shapes, sizes and ids. Access is checked against the database later. */
export function normalizeImport(body: unknown): NormalizedImport {
  const input = (body ?? {}) as Partial<MarkdownImportInput>;
  const text = (field: keyof MarkdownImportInput, max: number, required = true): string | null => {
    const value = input[field];
    if (value === undefined || value === null) {
      if (required) throw validationError(field, `${field} is required`);
      return null;
    }
    if (typeof value !== "string") throw validationError(field, `${field} must be a string`);
    if (value.length > max) throw validationError(field, `${field} is longer than ${max} characters`);
    return value;
  };
  const sourcePath = text("sourcePath", 512)!.trim();
  const title = text("title", 500)!.trim();
  if (!sourcePath) throw validationError("sourcePath", "sourcePath is required");
  if (!title) throw validationError("title", "title is required");
  const collectionId = text("collectionId", 64)!;
  if (!UUID_RE.test(collectionId)) throw validationError("collectionId", "collectionId must be a uuid");
  const parentTaskId = text("parentTaskId", 64, false);
  if (parentTaskId && !UUID_RE.test(parentTaskId)) throw validationError("parentTaskId", "parentTaskId must be a uuid");
  const checklists = input.checklists ?? "tasks";
  if (checklists !== "tasks" && checklists !== "text") throw validationError("checklists", "checklists must be tasks or text");
  return {
    sourcePath,
    title,
    plan: text("plan", MAX_SOURCE_CHARS)!,
    task: text("task", MAX_SOURCE_CHARS, false),
    collectionId,
    parentTaskId,
    checklists,
  };
}

/** Same hash means the same request: same source bytes, destination and options. */
export function importHash(input: NormalizedImport): string {
  const { title, plan, task, collectionId, parentTaskId, checklists } = input;
  return crypto.createHash("sha256").update(JSON.stringify({ title, plan, task, collectionId, parentTaskId, checklists })).digest("hex");
}

export interface BuiltImport {
  blocks: DocumentNode[];
  tasks: ParsedTask[];
  warnings: string[];
}

/** Parse plan.md and task.md into one document; task.md keeps its own heading. */
export function buildImport(input: NormalizedImport, rootDepth: number): BuiltImport {
  const maxDepth = MAX_DEPTH - rootDepth;
  const options = { checklists: input.checklists, maxDepth };
  const plan = parseMarkdown(input.plan, { ...options, keyPrefix: "p" });
  const blocks = [...plan.blocks];
  const tasks = [...plan.tasks];
  const warnings = [...plan.warnings];
  if (input.task !== null && input.task.trim() !== "") {
    const task = parseMarkdown(input.task, { ...options, keyPrefix: "k" });
    blocks.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: TASK_SECTION_TITLE }] }, ...task.blocks);
    tasks.push(...task.tasks);
    warnings.push(...task.warnings.map((warning) => `task.md: ${warning}`));
  }
  if (maxDepth < 1 && tasks.length > 0) throw validationError("parentTaskId", "The parent is too deep to hold imported subtasks");
  const total = countTasks(tasks);
  if (total > MAX_IMPORT_TASKS) throw validationError("plan", `An import creates at most ${MAX_IMPORT_TASKS} subtasks; this one has ${total}`);
  return { blocks, tasks, warnings: [...new Set(warnings)] };
}

export function countTasks(tasks: ParsedTask[], state?: ParsedTask["state"]): number {
  return tasks.reduce((sum, task) => sum + (state === undefined || task.state === state ? 1 : 0) + countTasks(task.children, state), 0);
}

/** Swap each placeholder for a real taskReference once the task ids exist. */
export function resolveBlocks(blocks: DocumentNode[], ids: ReadonlyMap<string, string>): DocumentNode {
  return {
    type: "doc",
    content: blocks.map((block) => {
      if (block.type !== "taskReference") return block;
      const key = String(block.attrs?.key);
      return { type: "taskReference", attrs: { taskId: ids.get(key)!, blockId: key } };
    }),
  };
}
