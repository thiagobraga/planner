import { useCallback, useEffect, useState } from 'react';
import { fetchMonthNotes, type ApiTask } from '../../api/client';
import { useSync } from '../../hooks/useSync';
import { MonthSelector } from './MonthSelector';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthlyNoteText(note: ApiTask): string {
  if (note.type === 'note') {
    return note.title;
  }

  const description = note.description?.trim();
  return description || note.title;
}

export interface MonthlyRowsProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

export function MonthlyRows({ year: selectedYear, month: selectedMonth, onMonthChange }: MonthlyRowsProps) {
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

    const isFuture = new Date(selectedYear, selectedMonth, day).getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return {
      day,
      weekday: WEEKDAYS[dayOfWeekIndex],
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
        onChange={onMonthChange}
        className="mb-6"
      />

      <div
        className="monthly-ledger overflow-hidden rounded-[3px]"
        style={{ backgroundColor: 'var(--planner-monthly-ledger-bg)' }}
      >
        {days.map((day) => {
          const key = dateKey(selectedYear, selectedMonth, day.day);
          const notes = notesByDate[key] ?? [];
          const rowStyle = day.isToday
            ? { backgroundColor: 'color-mix(in srgb, var(--color-ink-lighter) 15%, transparent)' }
            : day.isWeekend
              ? { backgroundColor: 'var(--planner-monthly-weekend)' }
              : undefined;

          return (
            <div
              key={day.day}
              style={rowStyle}
              className={`grid h-6 grid-cols-[24px_24px_minmax(0,1fr)] items-center border-b border-dotted border-dot/50 last:border-b-0 ${
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
