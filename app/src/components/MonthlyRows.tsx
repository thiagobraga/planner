import { useState } from 'react';

const YEARS = [2025, 2026];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_LABEL_WIDTH = 24;
const WEEKDAY_LABEL_WIDTH = 40;
const WRITING_AREA_START = DAY_LABEL_WIDTH + WEEKDAY_LABEL_WIDTH;

export function MonthlyRows() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(4); // May

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstSunday = Array.from({ length: daysInMonth }, (_, i) => i + 1).find(
    (day) => new Date(selectedYear, selectedMonth, day).getDay() === 0,
  );
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(selectedYear, selectedMonth, day);
    const dayOfWeekIndex = date.getDay();
    return {
      day,
      dayOfWeek: DAYS_OF_WEEK[dayOfWeekIndex],
      isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      startsWeekRule: dayOfWeekIndex === 0 && day !== 1,
    };
  });

  return (
    <div className="text-ink">
      {/* Year Selector */}
      <div className="flex gap-6 h-6 leading-6">
        {YEARS.map((y) => (
          <span
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`cursor-pointer text-[11px] tracking-[-0.01em] uppercase ${y === selectedYear ? 'font-semibold text-ink' : 'font-medium text-ink-light opacity-60'}`}
          >
            {y}
          </span>
        ))}
      </div>

      {/* Month Selector */}
      <div className="flex gap-4 h-12 leading-6 flex-wrap items-start">
        {MONTHS.map((m, idx) => (
          <span
            key={m}
            onClick={() => setSelectedMonth(idx)}
            className={`cursor-pointer text-[11px] tracking-[-0.01em] uppercase ${idx === selectedMonth ? 'font-semibold text-ink' : 'font-medium text-ink-light opacity-60'}`}
          >
            {m}
          </span>
        ))}
      </div>

      {/* Days */}
      <div className="flex flex-col">
        {days.map((d) => (
          <div key={d.day}>
            {d.startsWeekRule && (
              <div
                className={`h-6 flex items-center ${d.day === firstSunday ? '-mt-[10px]' : ''}`}
              >
                <div
                  className="w-[calc(100%-64px)] ml-16 border-t border-dot -mt-px"
                />
              </div>
            )}
            <div
              className="flex h-6 leading-6 text-[11px] tracking-[-0.01em] uppercase text-ink-light font-normal"
            >
              <span className="w-6 tabular-nums">
                {d.day.toString().padStart(2, '0')}
              </span>
              <span className="w-10">{d.dayOfWeek}</span>
              <div className="w-3 h-6 border-l border-dot opacity-80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
