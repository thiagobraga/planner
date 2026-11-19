/** What a node may hold: block nodes, inline nodes, list items, bare text, or nothing. */
export type DocumentContentKind = "block" | "inline" | "listItem" | "plainText" | "none";

export type DocumentNodeGroup = "doc" | "block" | "inline" | "listItem";

export interface DocumentAttrSpec {
  required: boolean;
  /** Checked only when the attr is present; `null` must be allowed here explicitly. */
  valid(value: unknown): boolean;
  message: string;
}

export interface DocumentNodeSpec {
  group: DocumentNodeGroup;
  content: DocumentContentKind;
  /** ProseMirror `+` content: at least one child. */
  nonEmpty?: boolean;
  /** Type the first child must have, e.g. listItem's leading paragraph. */
  firstChild?: string;
  attrs: Record<string, DocumentAttrSpec>;
}

export interface TaskDocumentRow {
  task_id: string;
  content: unknown;
  schema_version: number;
  revision: string;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
}
