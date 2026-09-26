import { useMemo, useState } from 'react';
import { MonthSelector } from './MonthSelector';
import { useI18n } from '../../i18n/I18nContext';
import type { Task } from '../TaskItem';

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface MonthlyViewProps {
  tasks: Task[];
  onToggle: (id: string) => void;
}

export function MonthlyView({ tasks, onToggle }: MonthlyViewProps) {
  const { locale, t } = useI18n();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = task.dueDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  const undatedTasks = useMemo(() => {
    return tasks.filter((task) => !task.dueDate);
  }, [tasks]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayOfWeekIndex = new Date(selectedYear, selectedMonth, day).getDay();
    const isFuture = new Date(selectedYear, selectedMonth, day).getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return {
      day,
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(
        new Date(selectedYear, selectedMonth, day),
      ),
      isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      isToday: dateKey(selectedYear, selectedMonth, day) === todayKey,
      isFuture,
    };
  });

  return (
    <div className="text-ink">
      <MonthSelector
        year={selectedYear}
        month={selectedMonth}
        onChange={handleMonthChange}
        className="mb-6"
      />

      <div
        className="monthly-ledger overflow-hidden rounded-[3px]"
        style={{ backgroundColor: 'var(--planner-monthly-ledger-bg)' }}
      >
        {days.map((day) => {
          const key = dateKey(selectedYear, selectedMonth, day.day);
          const dayTasks = tasksByDate[key] ?? [];
          const hasItems = dayTasks.length > 0;
          const rowStyle = day.isToday
            ? { backgroundColor: 'color-mix(in srgb, var(--color-ink-lighter) 15%, transparent)' }
            : day.isWeekend
              ? { backgroundColor: 'var(--planner-monthly-weekend)' }
              : undefined;

          return (
            <div
              key={day.day}
              style={rowStyle}
              className={`grid ${hasItems ? 'min-h-6' : 'h-6'} grid-cols-[24px_24px_minmax(0,1fr)] items-start border-b border-dotted border-dot/50 last:border-b-0 ${
                day.isFuture ? 'opacity-40' : ''
              }`}
            >
              <span className={`text-right text-[10px] leading-6 tracking-[0.08em] text-ink-light tabular-nums ${day.isToday ? 'monthly-current-day-label font-[800]' : 'font-medium'}`}>
                {day.day}
              </span>
              <span className={`text-center text-[10px] leading-6 tracking-[0.08em] text-ink-light uppercase ${day.isToday ? 'monthly-current-day-label font-[800]' : 'font-medium'}`}>
                {day.weekday}
              </span>
              <div className="min-w-0 pl-4">
                {hasItems ? (
                  <div className="flex flex-col">
                    {dayTasks.map((task) => (
                      <MonthlyTaskEntry
                        key={task.id}
                        task={task}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="block h-6" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undatedTasks.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light h-6 font-semibold mb-2">
            {t('date.noDate')}
          </div>
          <div
            className="monthly-ledger overflow-hidden rounded-[3px]"
            style={{ backgroundColor: 'var(--planner-monthly-ledger-bg)' }}
          >
            <div className="flex flex-col py-1 px-4">
              {undatedTasks.map((task) => (
                <MonthlyTaskEntry
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyTaskEntry({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const { t } = useI18n();
  const isCompleted = task.isCompleted;
  const type = task.type ?? 'task';

  return (
    <div className={`flex items-center min-h-6 ${isCompleted ? 'line-through opacity-50' : ''}`}>
      {type === 'note' ? (
        <span
          aria-hidden="true"
          className="text-[10px] text-ink-light w-4 shrink-0 text-center select-none"
        >
          -
        </span>
      ) : type === 'event' ? (
        <span
          aria-hidden="true"
          className="text-[10px] text-ink-light w-4 shrink-0 text-center select-none"
        >
          ○
        </span>
      ) : (
        <button
          type="button"
          aria-label={isCompleted ? t('task.reopen', { title: task.title }) : t('task.complete', { title: task.title })}
          aria-pressed={isCompleted}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className="w-4 shrink-0 flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
        >
          <span
            className={`block w-2 h-2 rounded-full border border-ink ${isCompleted ? 'bg-accent' : ''}`}
          />
        </button>
      )}
      <span className="text-[13px] leading-6 text-ink normal-case tracking-normal truncate">
        {task.title}
      </span>
    </div>
  );
}
