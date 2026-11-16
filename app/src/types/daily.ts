import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import type { Task, TaskListCallbacks } from './task';
import type { ApiTask } from './api';
import type { useDailyView } from '../hooks/useDailyView';
import type { WeekStart } from './utils';
import type { DailyViewSettings, ViewLayout } from './view';

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
  /** Days of the shown week before today, oldest first, empty ones included. */
  pastSections: DaySection[];
  /** Days after today, soonest first. Empty unless "next days" is on. */
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

export interface DailyToolbarProps {
  view: ReturnType<typeof useDailyView>;
  todayKey: string;
  weekStart: WeekStart;
  /** Reorganize is offered only when there is something to move. */
  onReorganize?: () => void;
  onToday: () => void;
}

export interface ListDaysInput {
  sections: DaySection[];
  from: string;
  to: string;
  todayKey: string;
  hideEmptyDays: boolean;
  /** A Reorganize preview hides the days before today. */
  preview: boolean;
  locale: 'en' | 'pt-BR';
  dateFormat: string;
}

export interface ListDays {
  /** Days of the range before today, empty ones included. */
  past: DaySection[];
  /** Days of the range after today. */
  future: DaySection[];
  /** Every day of a range that does not include today; null when it does. */
  browsed: DaySection[] | null;
}

export interface LegacyDailyView extends Partial<DailyViewSettings> {
  layout: ViewLayout;
}
