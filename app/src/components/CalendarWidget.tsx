import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthDays, dateFromISO, weekdayInitials, type WeekStart } from '../utils/date';

interface CalendarWidgetProps {
  activeDate: string;
  today: string;
  locale: 'en' | 'pt-BR';
  weekStart: WeekStart;
  loadedStart?: string;
  loadedEnd?: string;
  onDateClick: (date: string) => void;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function CalendarWidget({
  activeDate,
  today,
  locale,
  weekStart,
  loadedStart,
  loadedEnd,
  onDateClick,
}: CalendarWidgetProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(dateFromISO(activeDate)));

  const days = useMemo(
    () => buildMonthDays(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      dateFromISO(today),
      weekStart,
    ),
    [today, visibleMonth, weekStart],
  );
  const weekdayLabels = weekdayInitials(weekStart, locale);
  const monthLabel = visibleMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const previousLabel = locale === 'pt-BR' ? 'Mês anterior' : 'Previous month';
  const nextLabel = locale === 'pt-BR' ? 'Próximo mês' : 'Next month';
  const navigatorLabel = locale === 'pt-BR' ? 'Navegador de datas' : 'Date navigator';

  const shiftMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <aside className="daily-calendar" aria-label={navigatorLabel}>
      <div className="daily-calendar__eyebrow">
        {locale === 'pt-BR' ? 'Navegar' : 'Navigate'}
      </div>
      <div className="daily-calendar__month-row">
        <button type="button" className="daily-calendar__arrow" aria-label={previousLabel} onClick={() => shiftMonth(-1)}>
          <ChevronLeft aria-hidden size={14} strokeWidth={1.75} />
        </button>
        <div className="daily-calendar__month" aria-live="polite">{monthLabel}</div>
        <button type="button" className="daily-calendar__arrow" aria-label={nextLabel} onClick={() => shiftMonth(1)}>
          <ChevronRight aria-hidden size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className="daily-calendar__weekdays" aria-hidden>
        {weekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
      </div>
      <div className="daily-calendar__days">
        {days.map((day, index) => {
          const isActive = day.iso === activeDate;
          const isToday = day.iso === today;
          const isLoaded = (!loadedStart || day.iso >= loadedStart) && (!loadedEnd || day.iso <= loadedEnd);
          const date = dateFromISO(day.iso);
          const label = date.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return (
            <button
              key={day.iso}
              type="button"
              className={`daily-calendar__day${isActive ? ' daily-calendar__day--active' : ''}${isToday ? ' daily-calendar__day--today' : ''}`}
              style={index === 0 ? { gridColumnStart: day.dow + 1 } : undefined}
              aria-label={label}
              aria-current={isActive ? 'date' : undefined}
              data-date={day.iso}
              data-loaded={isLoaded ? 'true' : 'false'}
              onClick={() => onDateClick(day.iso)}
            >
              <span>{day.dayOfMonth}</span>
              {isLoaded && <span className="daily-calendar__loaded-mark" aria-hidden />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="daily-calendar__today-link"
        onClick={() => {
          setVisibleMonth(monthStart(dateFromISO(today)));
          onDateClick(today);
        }}
      >
        <span className="daily-calendar__today-rule" aria-hidden />
        {locale === 'pt-BR' ? 'Voltar para hoje' : 'Return to today'}
      </button>
    </aside>
  );
}
