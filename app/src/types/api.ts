import type { BackgroundPreference } from './theme';
import type { RecurrenceRule } from './task';
import type { BoardViewMode } from './board';
import type { BoardGroupBy, TaskOrderScope } from './drag';

export interface ValidationDetail {
  field: string;
  message: string;
}

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
}

export interface ApiTask {
  id: string;
  title: string;
  description?: string;
  priority: number;
  collectionId: string;
  sectionId?: string;
  parentTaskId?: string;
  dueDate?: string;
  dueTime?: string | null;
  endTime?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
  isCompleted: boolean;
  orderValue: number;
  depth: number;
  type: 'task' | 'note' | 'event';
  createdAt?: string;
  completedAt?: string | null;
  statusId?: string | null;
  labels?: LabelSummary[];
}

export interface LabelSummary {
  id: string;
  name: string;
  color: string;
}

export interface ApiStatus {
  id: string;
  collectionId: string;
  name: string;
  color: string;
  orderValue: number;
  createdAt: string;
  updatedAt: string;
}

export type BoardViewModes = Record<string, { view?: BoardViewMode; groupBy?: BoardGroupBy }>;

export interface Preferences {
  userId: string;
  locale: 'en' | 'pt-BR';
  timeZone: string;
  weekStart: 'sunday' | 'monday';
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  font: 'lora' | 'playpen' | 'hubballi';
  showDots: boolean;
  background: BackgroundPreference;
  smallCaps: boolean;
  hideCompletedTasks: boolean;
  showNotes: boolean;
  showCheckboxes?: boolean;
  agentChangeNotices?: boolean;
  collapsedCollectionIds: string[];
  boardViewModes: BoardViewModes;
  dateFormat?: string;
}

export interface TaskMoveInput {
  /** New parent, or null to place at the top level. */
  parentTaskId: string | null;
  /** Omit to keep the task's current collection. */
  collectionId?: string;
  /** ISO YYYY-MM-DD; null clears the date. Omit to keep the current one. */
  dueDate?: string | null;
  /** Omit to keep the task's current section. */
  sectionId?: string | null;
  statusId?: string | null;
  priority?: number;
  /** The list the task lands in. */
  scope: TaskOrderScope;
  /** Zero-based index within that scope. Clamped server-side. */
  position: number;
}

/** The trimmed per-task fields `moveTask` reports back - not a full task row. */
export interface MovedTaskSummary {
  id: string;
  parentTaskId: string | null;
  collectionId: string;
  dueDate: string | null;
  orderValue: number;
  depth: number;
  statusId: string | null;
  priority: number;
  isCompleted: boolean;
}

export interface TaskMoveResponse {
  /** The dragged task and every descendant, with updated depth/collection/date. */
  moved: MovedTaskSummary[];
  /** Rows in the target scope whose order value was written - the moved task itself, plus any sibling touched by a collision fallback. Source-scope siblings are never reported. */
  reordered: MovedTaskSummary[];
}

export interface ReorganizeMove {
  taskId: string;
  dueDate: string;
}

export interface ApiCollection {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  color: string;
  isInbox: boolean;
  isArchived: boolean;
  orderValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionView {
  collection: { id: string; name: string; color: string; isInbox: boolean };
  tasks: ApiTask[];
  collectionId: string;
  sections: ApiSection[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  boardOrder: BoardOrder;
}

export interface BoardOrder {
  status: Record<string, number>;
  priority: Record<string, number>;
}

export interface ApiSection {
  id: string;
  name: string;
  collectionId: string;
  orderValue: number;
}

export interface ApiHabit {
  id: string;
  name: string;
  // Sub-habits are one level deep: a habit with a parentId has no children of its own.
  parentId: string | null;
  // Sub-habits inherit their parent's group, so their own groupId is always null.
  groupId: string | null;
  orderValue: number;
  createdAt?: string;
  completions: string[]; // ISO dates (YYYY-MM-DD)
}

export interface ApiHabitGroup {
  id: string;
  name: string;
  icon: string | null;
  orderValue: number;
}

export interface HabitsResponse {
  habits: ApiHabit[];
  groups: ApiHabitGroup[];
}

export interface HabitMoveInput {
  /**
   * New parent, or null to sit as a root. A habit that has children cannot take
   * a parent - the hierarchy is only one level deep.
   */
  parentId: string | null;
  /**
   * New group, or null for ungrouped. Must be null when `parentId` is set: a
   * sub-habit inherits its parent's group.
   */
  groupId: string | null;
  /** Zero-based index among the habits sharing the target parent/group scope. */
  position: number;
}

export interface HabitMoveResponse {
  /** The moved habit plus any children carried along with it. */
  moved: ApiHabit[];
  /** Every other habit whose parent, group or order value changed. */
  reordered: ApiHabit[];
}

export interface HabitGroupMoveInput {
  /** Zero-based index among the user's groups. */
  position: number;
}

export interface HabitGroupMoveResponse {
  /** Every group whose order value changed, including the moved one. */
  reordered: ApiHabitGroup[];
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  disabledAt: string | null;
  lastSeenAt: string | null;
  activeSessions: number;
}

export interface AdminUserList {
  users: AdminUser[];
  nextCursor: string | null;
}

export interface AdminCounts {
  users: number;
  activeUsers: number;
  disabledUsers: number;
  admins: number;
  tasks: number;
  completedTasks: number;
  collections: number;
  habits: number;
}

export interface AdminHealth {
  database: {
    status: 'up' | 'down';
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
  };
  redis: { status: 'up' | 'down' };
  process: {
    uptimeSeconds: number;
    memoryRssBytes: number;
    nodeVersion: string;
  };
}

export interface AdminAuthStats {
  activeSessions: number;
  sessionsLastDay: number;
  usersOnlineLastHour: number;
  throttledAccounts: number;
  throttledIps: number;
  failedLoginAttempts: number;
}
