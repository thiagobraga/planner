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
    <div style={{ fontFamily: '"Lora", serif', color: 'var(--color-ink)' }}>
      {/* Year Selector */}
      <div style={{ display: 'flex', gap: '24px', height: '24px', lineHeight: '24px' }}>
        {YEARS.map((y) => (
          <span
            key={y}
            onClick={() => setSelectedYear(y)}
            style={{
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              fontWeight: y === selectedYear ? 600 : 500,
              color: y === selectedYear ? 'var(--color-ink)' : 'var(--color-ink-light)',
              opacity: y === selectedYear ? 1 : 0.6,
            }}
          >
            {y}
          </span>
        ))}
      </div>

      {/* Month Selector */}
      <div style={{ display: 'flex', gap: '16px', height: '48px', lineHeight: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {MONTHS.map((m, idx) => (
          <span
            key={m}
            onClick={() => setSelectedMonth(idx)}
            style={{
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              fontWeight: idx === selectedMonth ? 600 : 500,
              color: idx === selectedMonth ? 'var(--color-ink)' : 'var(--color-ink-light)',
              opacity: idx === selectedMonth ? 1 : 0.6,
            }}
          >
            {m}
          </span>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {days.map((d) => (
          <div key={d.day}>
            {d.startsWeekRule && (
              <div
                style={{
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: d.day === firstSunday ? '-10px' : 0,
                }}
              >
                <div
                  style={{
                    width: `calc(100% - ${WRITING_AREA_START}px)`,
                    marginLeft: `${WRITING_AREA_START}px`,
                    borderTop: '1px solid var(--color-dot)',
                    marginTop: '-1px',
                  }}
                />
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: '0px',
                height: '24px',
                lineHeight: '24px',
                fontSize: '11px',
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-light)',
                fontWeight: 400,
              }}
            >
              <span style={{ width: `${DAY_LABEL_WIDTH}px`, fontVariantNumeric: 'tabular-nums' }}>
                {d.day.toString().padStart(2, '0')}
              </span>
              <span style={{ width: `${WEEKDAY_LABEL_WIDTH}px` }}>{d.dayOfWeek}</span>
              <div
                style={{
                  width: '12px',
                  height: '24px',
                  borderLeft: '1px solid var(--color-dot)',
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
