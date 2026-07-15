import { useCallback, useEffect, useState } from 'react';
import { fetchMonthNotes, type ApiTask } from '../../api/client';
import { useSync } from '../../hooks/useSync';
import { MonthSelector } from './MonthSelector';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getInitialMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthlyNoteText(note: ApiTask): string {
  if (note.type === 'note') {
    return note.title;
  }

  const description = note.description?.trim();
  return description || note.title;
}

export function MonthlyRows() {
  const initialMonth = getInitialMonth();
  const [selectedYear, setSelectedYear] = useState(initialMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth.month);
  const [notesByDate, setNotesByDate] = useState<Record<string, string[]>>({});

  const loadMonthNotes = useCallback(() => {
    let active = true;

    fetchMonthNotes(selectedYear, selectedMonth + 1)
      .then((res) => {
        if (!active) {
          return;
        }

        const byDate: Record<string, string[]> = {};
        for (const [date, notes] of Object.entries(res.notesByDate)) {
          byDate[date] = notes.map(monthlyNoteText).filter((text) => text.length > 0);
        }
        setNotesByDate(byDate);
      })
      .catch(() => {
        if (active) {
          setNotesByDate({});
        }
      });

    return () => {
      active = false;
    };
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    return loadMonthNotes();
  }, [loadMonthNotes]);

  useSync(useCallback((event) => {
    if (event.entityType === 'task') {
      loadMonthNotes();
    }
  }, [loadMonthNotes]));

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayOfWeekIndex = new Date(selectedYear, selectedMonth, day).getDay();

    return {
      day,
      weekday: WEEKDAYS[dayOfWeekIndex],
      isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      isToday: dateKey(selectedYear, selectedMonth, day) === todayKey,
    };
  });

  return (
    <div className="text-ink">
      <MonthSelector
        year={selectedYear}
        month={selectedMonth}
        onChange={(year, month) => {
          setSelectedYear(year);
          setSelectedMonth(month);
        }}
        className="mb-6"
      />

      <div
        className="monthly-ledger overflow-hidden rounded-[3px] border border-border/80"
        style={{ backgroundColor: 'var(--planner-monthly-ledger-bg)' }}
      >
        {days.map((day) => {
          const key = dateKey(selectedYear, selectedMonth, day.day);
          const notes = notesByDate[key] ?? [];
          const weekendStyle = day.isWeekend ? { backgroundColor: 'var(--planner-monthly-weekend)' } : undefined;

          return (
            <div
              key={day.day}
              style={weekendStyle}
              className="grid h-6 grid-cols-[30px_20px_minmax(0,1fr)] items-center border-b border-border/60 last:border-b-0"
            >
              <span className={`text-center text-[10px] leading-6 tracking-[0.08em] text-ink-light tabular-nums ${day.isToday ? 'monthly-current-day-label font-[800]' : 'font-medium'}`}>
                {String(day.day).padStart(2, '0')}
              </span>
              <span className={`text-center text-[10px] leading-6 tracking-[0.08em] text-ink-light uppercase ${day.isToday ? 'monthly-current-day-label font-[800]' : 'font-medium'}`}>
                {day.weekday}
              </span>
              <div className="min-w-0 border-l border-dot/30 pl-4">
                {notes.length > 0 ? (
                  <span className="block min-w-0 truncate text-[13px] leading-6 text-ink normal-case tracking-normal">
                    {notes.join(' · ')}
                  </span>
                ) : (
                  <span className="block h-6" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
