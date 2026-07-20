import { weekdayColumnIndex, weekdayShortNames, type WeekStart } from '../../utils/date';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTH_START_DAY = 5;

const MONTH_TASKS: Record<number, string[]> = {
  4: ['Rent'],
  8: ['Review goals'],
  13: ['Collection check-in'],
  16: ['Weekly reset'],
  21: ['Send invoices'],
  28: ['Plan June'],
};

interface MonthlyCalendarSpecimenProps {
  compact?: boolean;
  weekStart: WeekStart;
}

export function MonthlyCalendarSpecimen({ compact = false, weekStart }: MonthlyCalendarSpecimenProps) {
  const weekdays = weekdayShortNames(weekStart);
  const startOffset = weekdayColumnIndex(MONTH_START_DAY, weekStart);

  return (
    <div className="grid grid-cols-7 border-t border-l border-dot">
      {weekdays.map((day) => (
        <div
          key={day}
          data-weekday-label
          className={`h-6 leading-6 ${compact ? 'px-1' : 'px-2'} text-[10px] tracking-[0.08em] uppercase text-ink-light border-r border-b border-dot font-medium`}
        >
          {day}
        </div>
      ))}

      {Array.from({ length: startOffset }).map((_, i) => (
        <div
          key={`blank-${i}`}
          data-calendar-blank
          className={`${compact ? 'min-h-14' : 'min-h-[72px]'} border-r border-b border-dot bg-white/[0.18]`}
        />
      ))}

      {DAYS.map((day) => {
        const tasks = MONTH_TASKS[day] ?? [];
        return (
          <div
            key={day}
            className={`${compact ? 'min-h-14 p-1' : 'min-h-[72px] py-1 px-2'} border-r border-b border-dot`}
          >
            <div
              className={`text-xs leading-5 text-ink ${day === 16 ? 'font-semibold' : 'font-normal'}`}
            >
              {day}
            </div>
            {tasks.map((task) => (
              <div
                key={task}
                className="text-[11px] leading-[18px] text-ink-light truncate"
              >
                {task}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
