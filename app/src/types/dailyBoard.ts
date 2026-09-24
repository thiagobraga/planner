import type { ApiTask } from '../api/client';
import type { Task } from '../components/TaskItem';
import type { TaskListCallbacks } from '../components/TaskList';
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

export interface DailyWeekBoardProps {
  tasks: Task[];
  weekAnchor: Date;
  today: Date;
  todayKey: string;
  weekStart: WeekStart;
  dateFormat: string;
  onWeekChange: (date: Date) => void;
  onToggle?: (taskId: string, completed: boolean) => void;
  onCreate: DailyBoardColumnProps['onCreate'];
  onOrganize?: DailyBoardColumnProps['onOrganize'];
  presentation?: DailyBoardColumnProps['presentation'];
  taskListProps?: DailyBoardColumnProps['taskListProps'];
}
import type { ReactNode } from 'react';
