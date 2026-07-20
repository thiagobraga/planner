import { useMemo, useState } from 'react';
import {
  fmtISO,
  startOfDay,
  weekdayColumnIndex,
  weekdayInitials,
  type WeekStart,
} from '../../utils/date';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function DatePickerSpecimen({ weekStart }: { weekStart: WeekStart }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayISO = fmtISO(today);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(todayISO);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayColumn = weekdayColumnIndex(new Date(year, month, 1).getDay(), weekStart);
  const dayLabels = weekdayInitials(weekStart);

  const cells = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return {
      iso: fmtISO(date),
      day: index + 1,
      future: date > today,
    };
  });

  return (
    <div className="w-fit">
      <div className="mb-3 flex items-center justify-between" style={{ width: 7 * 24 }}>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-ink-light transition-colors hover:bg-dot/30 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[11px] font-medium tracking-[0.04em] text-ink">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-ink-light transition-colors hover:bg-dot/30 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 24px)' }}>
        {dayLabels.map((label, index) => (
          <span
            key={index}
            data-weekday-label
            className="flex h-6 items-center justify-center text-[10px] font-medium text-ink-light opacity-60"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 24px)' }}>
        {Array.from({ length: firstDayColumn }, (_, index) => (
          <span key={`blank-${index}`} data-calendar-blank aria-hidden="true" style={{ width: 24, height: 24 }} />
        ))}
        {cells.map(({ iso, day, future }) => {
          const isSelected = iso === selected;
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              disabled={future}
              onClick={() => setSelected(iso)}
              className={`flex cursor-pointer items-center justify-center rounded-full border-none text-[11px] transition-colors duration-[var(--motion-fast)] disabled:cursor-default disabled:opacity-30 ${
                isSelected
                  ? 'bg-ink font-semibold text-cream'
                  : isToday
                    ? 'border border-ink bg-transparent font-semibold text-ink'
                    : 'bg-transparent text-ink-light hover:bg-dot/40 hover:text-ink'
              }`}
              style={{ width: 24, height: 24 }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
