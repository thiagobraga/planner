import type { ApiTask } from '../../api/client';
import type { Task } from '../TaskItem';
import type { DailyWeekBoardProps } from '../../types/dailyBoard';
import { buildDayColumns, slotTaskIntoColumn } from '../../utils/dayColumns';
import { shiftWeek, startOfWeek, formatWeekRangeLabel } from '../../utils/date';
import { StripNavigator } from '../ui/StripNavigator';
import { DailyBoardColumn } from './DailyBoardColumn';
import { useI18n } from '../../i18n/I18nContext';

function toApiTask(task: Task): ApiTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    collectionId: task.collectionId ?? '',
    sectionId: task.sectionId,
    parentTaskId: task.parentTaskId,
    dueDate: task.dueDate,
    isCompleted: task.isCompleted,
    orderValue: task.orderValue,
    depth: task.indent ?? 0,
    type: task.type,
    createdAt: task.createdAt,
    statusId: task.statusId,
    labels: task.labels,
  };
}

function formatColumnDate(iso: string, locale: 'en' | 'pt-BR', format: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const clean = (value: string) => locale === 'pt-BR' ? value.replace(/\./g, '') : value;
  const month = clean(date.toLocaleDateString(locale, { month: 'short' })).toLocaleUpperCase(locale);
  const day = String(date.getDate()).padStart(2, '0');
  const weekday = clean(date.toLocaleDateString(locale, { weekday: 'short' })).toLocaleUpperCase(locale);
  const year = date.getFullYear();

  switch (format) {
    case 'DD/MM ddd': return `${day}/${String(date.getMonth() + 1).padStart(2, '0')} ${weekday}`;
    case 'DD-MM-YYYY ddd': return `${day}-${String(date.getMonth() + 1).padStart(2, '0')}-${year} ${weekday}`;
    case 'ddd MMM DD': return `${weekday} ${month} ${day}`;
    case 'YYYY-MM-DD': return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${day}`;
    default: return `${month} ${day} ${weekday}`;
  }
}

export function DailyWeekBoard({ tasks, weekAnchor, today, todayKey, weekStart, dateFormat, onWeekChange, onToggle, onCreate, onOrganize, presentation, taskListProps }: DailyWeekBoardProps) {
  const { locale, t } = useI18n();

  const apiTasks = tasks.map(toApiTask);
  const rootTasks = apiTasks.filter((task) => !task.parentTaskId);
  const rootTasksByColumn = new Map<string, ApiTask[]>();
  for (const task of rootTasks) {
    const columnId = slotTaskIntoColumn(task, todayKey);
    const bucket = rootTasksByColumn.get(columnId);
    if (bucket) bucket.push(task);
    else rootTasksByColumn.set(columnId, [task]);
  }
  const columns = buildDayColumns(weekAnchor, today, weekStart);

  const weekRangeLabel = (() => {
    const start = startOfWeek(weekAnchor, weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatWeekRangeLabel(start, end, locale);
  })();

  const columnTitle = (column: (typeof columns)[number]): string => {
    if (column.id === 'migrate') return t('board.migrate');
    return formatColumnDate(column.iso!, locale, dateFormat);
  };

  return (
    <div className="daily-week-board">
      <div className="daily-week-board-nav flex items-center gap-2">
        <StripNavigator
          direction="previous"
          aria-label={t('page.previousWeek')}
          onClick={() => onWeekChange(shiftWeek(weekAnchor, -1))}
        />
        <span className="daily-week-board-label text-sm font-medium text-ink">{weekRangeLabel}</span>
        <StripNavigator
          direction="next"
          aria-label={t('page.nextWeek')}
          onClick={() => onWeekChange(shiftWeek(weekAnchor, 1))}
        />
      </div>

      <div className="board-scroll" data-testid="daily-week-board">
        <div className="board-grid">
          {columns.map((column) => (
            <DailyBoardColumn
              key={column.id}
              column={column}
              title={columnTitle(column)}
              isToday={column.iso === todayKey}
              tasks={rootTasksByColumn.get(column.id) ?? []}
              allTasks={apiTasks}
              onToggle={onToggle}
              onCreate={onCreate}
              onOrganize={column.id === 'migrate' ? onOrganize : undefined}
              presentation={presentation}
              taskListProps={taskListProps}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
