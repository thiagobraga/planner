// Shared wire contract. api/src/contracts and app/src/contracts must stay
// byte-identical (scripts/check-contracts.sh): types only, no imports.

/** A ProseMirror mark as Tiptap's getJSON() emits it. */
export interface DocumentMark {
  type: 'bold' | 'italic' | 'strike' | 'code' | 'link';
  attrs?: Record<string, unknown>;
}

/** A ProseMirror node as Tiptap's getJSON() emits it; the root has type 'doc'. */
export interface DocumentNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocumentNode[];
  text?: string;
  marks?: DocumentMark[];
}

/**
 * A task's rich body. Revision 0 means no document is stored yet and the
 * content is seeded from the plain description; the first PUT uses
 * baseRevision 0.
 */
export interface TaskDocumentDto {
  taskId: string;
  content: DocumentNode;
  schemaVersion: number;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** PUT /tasks/:id/document. Succeeds only while baseRevision is still current. */
export interface DocumentPutRequest {
  content: DocumentNode;
  baseRevision: number;
}

/** 409 from PUT when someone saved first: merge against `current` and retry. */
export interface DocumentConflictError {
  error: {
    code: 'DOCUMENT_CONFLICT';
    message: string;
    details: [{ current: TaskDocumentDto }];
  };
}

/** 409 from a plain description write once the task has a document. */
export interface DocumentExistsError {
  error: {
    code: 'DOCUMENT_EXISTS';
    message: string;
    details: [{ revision: number }];
  };
}
