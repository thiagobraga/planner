import type { DocumentNode } from "../contracts/document.js";

/** A checklist item that becomes a real task: `[ ]`, `[x]` (done) or `[~]` (in progress). */
export interface ParsedTask {
  /** Stable within one parse, used as the taskReference blockId. */
  key: string;
  title: string;
  state: "open" | "done" | "doing";
  children: ParsedTask[];
}

/**
 * Parsed Markdown: document blocks where every top-level checklist item is a
 * placeholder `{ type: "taskReference", attrs: { key } }` until ids exist.
 */
export interface ParsedMarkdown {
  blocks: DocumentNode[];
  tasks: ParsedTask[];
  warnings: string[];
}

export interface MarkdownImportInput {
  /** Identifies the source, for example `.specs/2026-11-15-guest-mode`. */
  sourcePath: string;
  title: string;
  /** plan.md, the description body. */
  plan: string;
  /** task.md, kept under its own heading in the same description. */
  task?: string | null;
  collectionId: string;
  parentTaskId?: string | null;
  /** `tasks` (default) turns checklist items into subtasks; `text` keeps them as prose. */
  checklists?: "tasks" | "text";
}

export interface ImportPreview {
  sourcePath: string;
  sourceHash: string;
  destination: { collectionId: string; parentTaskId: string | null };
  cards: number;
  subtasks: number;
  documents: number;
  completed: number;
  inProgress: number;
  warnings: string[];
  /** Set when this exact source was already imported: applying returns it. */
  existingManifestId: string | null;
}

export interface ImportManifestItem {
  taskId: string;
  role: "root" | "subtask";
}

export interface ImportResult {
  manifestId: string;
  rootTaskId: string;
  taskIds: string[];
  warnings: string[];
  /** True when an identical earlier import was returned instead of writing again. */
  deduplicated: boolean;
}

export interface UndoResult {
  manifestId: string;
  deleted: string[];
  /** Changed since import (edited, completed, moved, commented, given children): kept. */
  kept: string[];
}
