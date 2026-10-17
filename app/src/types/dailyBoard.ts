import type { ApiTask } from '../api/client';
import type { Task } from '../types/tasks';
import type { TaskListCallbacks } from '../types/tasks';
import type { BoardViewMode } from './board';
import type { DayColumn } from '../utils/dayColumns';
import type { WeekStart } from '../utils/date';

export interface DailyBoardColumnProps {
  column: DayColumn;
  title: string;
  isToday?: boolean;
  tasks: ApiTask[];
  allTasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
  onCreate: (title: string, dueDate?: string) => Promise<void>;
  onOrganize?: () => void;
  presentation?: Exclude<BoardViewMode, 'list'>;
  taskListProps?: TaskListCallbacks & {
    editingId?: string;
    activeDragId?: string | null;
    renderBadge?: (task: Task) => ReactNode;
  };
}

export interface WeekSelectorProps {
  weekAnchor: Date;
  today: Date;
  weekStart: WeekStart;
  onWeekChange: (date: Date) => void;
  /** Overrides the default jump to the week of `today`. */
  onToday?: () => void;
}

export interface DailyWeekBoardProps {
  tasks: Task[];
  weekAnchor: Date;
  today: Date;
  todayKey: string;
  weekStart: WeekStart;
  dateFormat: string;
  onWeekChange: (date: Date) => void;
  onToday?: () => void;
  onToggle?: (taskId: string, completed: boolean) => void;
  onCreate: DailyBoardColumnProps['onCreate'];
  onOrganize?: DailyBoardColumnProps['onOrganize'];
  presentation?: DailyBoardColumnProps['presentation'];
  taskListProps?: DailyBoardColumnProps['taskListProps'];
}
import type { ReactNode } from 'react';
