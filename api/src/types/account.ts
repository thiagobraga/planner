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

export interface AccountUserRow {
  email: string;
  display_name: string;
  created_at: Date | string;
}

export interface AccountPreferencesRow {
  time_zone: string;
  week_start: string;
  theme: string;
  notifications_enabled: boolean;
  font: string;
  show_dots: boolean;
  background: string;
  small_caps: boolean;
  hide_completed_tasks: boolean;
  show_notes: boolean;
  agent_change_notices: boolean;
  locale: string;
  date_format: string | null;
}

export interface AccountCollectionRow {
  id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_inbox: boolean;
  is_archived: boolean;
  order_value: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AccountTaskRow {
  id: string;
  collection_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: Date | string | null;
  due_time: string | null;
  due_timezone: string | null;
  deadline_date: Date | string | null;
  deadline_time: string | null;
  deadline_timezone: string | null;
  duration_minutes: number | null;
  recurrence_rule: unknown;
  is_completed: boolean;
  completed_at: Date | string | null;
  order_value: number;
  depth: number;
  type: string;
  status_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AccountLabelRow {
  id: string;
  name: string;
  color: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AccountSectionRow {
  id: string;
  collection_id: string;
  name: string;
  order_value: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AccountHabitRow {
  id: string;
  name: string;
  order_value: number;
  parent_id: string | null;
  group_id: string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AccountHabitCompletionRow {
  habit_id: string;
  completed_date: Date | string;
  created_at: Date | string;
}

export interface AccountFilterRow {
  id: string;
  name: string;
  query: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AccountCommentRow {
  id: string;
  task_id: string;
  body: string;
  created_at: Date | string;
  updated_at: Date | string | null;
}

export interface AccountReminderRow {
  id: string;
  task_id: string;
  remind_at: Date | string;
  is_fired: boolean;
  created_at: Date | string;
}
