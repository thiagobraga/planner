import type { WeekStart } from '../utils/date';

export type HabitsView = 'timeline' | 'calendar';

export interface HabitsToolbarProps {
  view: HabitsView;
  onViewChange: (view: HabitsView) => void;
  weekAnchor: Date;
  today: Date;
  weekStart: WeekStart;
  onWeekChange: (date: Date) => void;
  /** Back to the current week (timeline) or month (calendar). */
  onToday: () => void;
  /** `[` and `]` in the calendar step one month. */
  onMonthShift: (delta: -1 | 1) => void;
}
