import type { DocumentNode, TaskDocumentDto } from '../contracts/document';
import type { TaskDetailItem } from '../contracts/taskDetail';

export interface SubtreeRow {
  item: TaskDetailItem;
  depth: number;
}

export type DetailMode = 'full' | 'tasks';

/** How the panel is laid out for the current viewport and page. */
export type DetailLayout = 'dock' | 'overlay' | 'sheet';

export interface OpenDetailsOptions {
  /** Where focus goes back to on close; defaults to the active element. */
  origin?: HTMLElement | null;
  /** Move focus into the panel (keyboard opens); a pointer open leaves it on the row. */
  focusPanel?: boolean;
}

export interface DetailNavigator {
  open: (taskId: string, replace: boolean) => void;
  close: () => void;
}

export interface TaskDetailState {
  taskId: string | null;
  navigator: DetailNavigator | null;
  origin: HTMLElement | null;
  focusRequest: number;
  /** Set by the open document; returns false when the user keeps the draft. */
  leaveGuard: (() => boolean) | null;
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface DocumentDraftState {
  status: SaveStatus;
  /** The server version the next save builds on. */
  base: TaskDocumentDto | null;
  /** Unsaved local content; null when the editor matches `base`. */
  draft: DocumentNode | null;
  /** The newer server version a 409 returned. */
  conflict: TaskDocumentDto | null;
  error: string | null;
}
