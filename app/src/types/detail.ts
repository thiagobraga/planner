import type { DocumentNode, TaskDocumentDto } from '../contracts/document';
import type { TaskDetailItem } from '../contracts/taskDetail';

/** What the subtree helpers read, so detail items and board tasks share them. */
export interface SubtreeItem {
  id: string;
  parentTaskId?: string | null;
  type: 'task' | 'note' | 'event';
  isCompleted: boolean;
  orderValue: number;
}

export interface SubtreeRow<T extends SubtreeItem = TaskDetailItem> {
  item: T;
  depth: number;
}

/** What an embedded task block reads: the canonical subtree items and the two actions it can take. */
export interface TaskReferenceContextValue {
  items: ReadonlyMap<string, TaskDetailItem>;
  onToggle: (taskId: string, completed: boolean) => void;
  onOpen: (taskId: string) => void;
}

export interface LeafProgress {
  done: number;
  total: number;
}

export type DetailMode = 'full' | 'tasks';

/** How the panel is laid out for the current viewport and page. */
export type DetailLayout = 'dock' | 'overlay' | 'sheet';

export interface OpenDetailsOptions {
  /** Where focus goes back to on close; defaults to the active element. */
  origin?: HTMLElement | null;
  /** Switch the panel to this mode while opening; omitted keeps the current one. */
  mode?: DetailMode;
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
  mode: DetailMode;
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
