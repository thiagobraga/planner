import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import type { TaskListCallbacks } from '../components/TaskList';
import type { Task } from '../components/TaskItem';
import type { ApiTask } from '../api/client';

/** The view segment of /daily/<view>. */
export type DailySlug = 'list' | 'kanban' | 'cards' | 'monthly';

export interface DailyRange {
  from: string;
  to: string;
}

export interface ApiDailyView extends DailyRange {
  today: string;
  overdue: ApiTask[];
  days: { date: string; tasks: ApiTask[] }[];
}

export interface DaySection {
  key: string;
  label: string;
  tasks: Task[];
}

export interface DailyListProps {
  /** Days after today, furthest first. Empty unless "next days" is on. */
  futureSections: DaySection[];
  /** Today and earlier, newest first. */
  currentSections: DaySection[];
  todayKey: string;
  /** A Reorganize preview is showing; per-day add inputs stay hidden. */
  isPreview: boolean;
  todaySectionRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLDivElement | null>;
  input: string;
  onInputChange: (value: string) => void;
  onAddToday: (text: string) => void;
  onAddTodayKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  futureInputs: Record<string, string>;
  onFutureInputChange: (dateKey: string, text: string) => void;
  onAddFuture: (dateKey: string, text: string) => void;
  onTaskToggle: (id: string) => void;
  taskListProps: TaskListCallbacks & {
    editingId?: string;
    activeDragId?: string | null;
    renderBadge?: (task: Task) => ReactNode;
  };
}
