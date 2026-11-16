import type {
  ApiSection,
  ApiStatus,
  ApiTask,
  AuthUser,
  BoardOrder,
  Preferences,
  ReorganizeMove,
  TaskMoveInput,
} from './api';
import type { BoardGroupBy } from './drag';

/** Hook and context value types, extracted from their implementations. */

export type VisibilityPreferenceKey = 'hideCompletedTasks' | 'showNotes';

export interface VisibilityPreferenceUpdate {
  key: VisibilityPreferenceKey;
  value: boolean;
}

export type ShortcutContext = 'global' | 'always';

export interface SingleBinding {
  key: string;
  context?: ShortcutContext;
  action: string;
}

export interface ChordBinding {
  keys: [string, string];
  context?: ShortcutContext;
  action: string;
}

export type Binding = SingleBinding | ChordBinding;

export interface KeyEvent {
  key: string;
  isTextInputFocused: boolean;
  timestamp: number;
}

export interface MatcherState {
  pendingChord: { firstKey: string; firstAt: number } | null;
}

export type Position = { x: number; y: number };

export type Placement = 'below' | 'above' | 'right' | 'left';

export type Align = 'start' | 'end';

export interface FloatingOptions {
  /** If provided, positions exactly at this coordinate (e.g. context menu) */
  position?: Position;
  /** Primary placement for anchor-based positioning */
  placement?: Placement;
  /** Alignment for anchor-based positioning */
  align?: Align;
  /** Minimum distance from viewport edges */
  padding?: number;
  /** Submenu offset if placing to the right/left */
  offset?: number;
}

export interface FloatingResult {
  top: number;
  left: number;
  placement: Placement;
}

export type MidnightCallback = () => void;

export interface VersionResponse {
  current: string;
  latest: string;
}

export interface UseBoardDragOptions {
  enabled?: boolean;
  tasks: ApiTask[];
  boardOrder: BoardOrder;
  groupBy: BoardGroupBy;
  collectionId: string;
  statuses: ApiStatus[];
  sections: ApiSection[];
  completionStatusId: string | null;
  setTasks: (updater: (prev: ApiTask[]) => ApiTask[]) => void;
  setBoardOrder: (updater: (prev: BoardOrder) => BoardOrder) => void;
  onError?: () => void;
  onMoved?: () => void;
}

export interface ResolvedBoardMove {
  input: TaskMoveInput;
  announcement: string;
  preview: string;
  parentTaskId: string | null;
}

export interface BoardMoveSnapshot {
  tasks: ApiTask[];
  boardOrder: BoardOrder;
}

export interface BoardA11yMessages {
  dropToColumn: (column: string) => string;
  movedToColumn: (column: string) => string;
  dropAsSubtask: (title: string) => string;
}

export type ReorganizeState = 'idle' | 'preview' | 'persisting';

export interface Section {
  date: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
}

export interface ReorganizePreview {
  moves: ReorganizeMove[];
  sections: Section[];
}

export interface UseReorganizeReturn {
  showButton: boolean;
  state: ReorganizeState;
  startPreview: () => void;
  confirmReorganize: () => Promise<void>;
  cancelReorganize: () => void;
  previewSections: Section[] | null;
}

export type PreferencesPatch = Partial<Omit<Preferences, 'userId'>>;

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}
