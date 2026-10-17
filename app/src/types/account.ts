export interface ExportedUser {
  email: string;
  displayName: string;
  createdAt: string;
}

export interface ExportedPreferences {
  timeZone: string;
  weekStart: string;
  theme: string;
  notificationsEnabled: boolean;
  font: string;
  showDots: boolean;
  background: string;
  smallCaps: boolean;
  hideCompletedTasks: boolean;
  showNotes: boolean;
  agentChangeNotices: boolean;
  locale: string;
  dateFormat: string;
}

export interface ExportedCollection {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
  isInbox: boolean;
  isArchived: boolean;
  orderValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedTask {
  id: string;
  collectionId: string;
  sectionId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: number;
  dueDate: string | null;
  dueTime: string | null;
  dueTimezone: string | null;
  deadlineDate: string | null;
  deadlineTime: string | null;
  deadlineTimezone: string | null;
  durationMinutes: number | null;
  recurrenceRule: unknown;
  isCompleted: boolean;
  completedAt: string | null;
  orderValue: number;
  depth: number;
  type: string;
  statusId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedLabel {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedSection {
  id: string;
  collectionId: string;
  name: string;
  orderValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedHabit {
  id: string;
  name: string;
  orderValue: number;
  parentId: string | null;
  groupId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedHabitCompletion {
  habitId: string;
  completedDate: string;
  createdAt: string;
}

export interface ExportedFilter {
  id: string;
  name: string;
  query: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedComment {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExportedReminder {
  id: string;
  taskId: string;
  remindAt: string;
  isFired: boolean;
  createdAt: string;
}

export interface AccountExportData {
  user: ExportedUser;
  preferences: ExportedPreferences | null;
  collections: ExportedCollection[];
  tasks: ExportedTask[];
  labels: ExportedLabel[];
  sections: ExportedSection[];
  habits: ExportedHabit[];
  habitCompletions: ExportedHabitCompletion[];
  filters: ExportedFilter[];
  comments: ExportedComment[];
  reminders: ExportedReminder[];
}
