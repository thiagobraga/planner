import type { ApiTokenScope } from "./apiToken.js";

export interface McpAuthContext {
  userId: string;
  scopes: ApiTokenScope[];
  /** Injectable clock so tests can pin "today". */
  now: () => Date;
}

/** The subset of a task row the MCP formatter reads; every view service returns at least this. */
export interface McpTaskLike {
  id: string;
  title: string;
  collectionId?: string | null;
  priority?: number | null;
  dueDate?: string | Date | null;
  dueTime?: string | null;
  deadlineDate?: string | Date | null;
  isCompleted?: boolean;
  recurrenceRule?: unknown;
  type?: string | null;
  labels?: Array<{ name: string }>;
  labelNames?: string[];
  collectionName?: string;
}

export interface ResolvedDue {
  dueDate: string;
  dueTime: string | null;
  recurrenceRule: object | null;
}

export interface NamedRef {
  id: string;
  name: string;
}
