import { Calendar } from 'lucide-react';
import { usePageShortcuts } from '../../hooks/usePageShortcuts';
import { useI18n } from '../../i18n/I18nContext';
import type { HabitsToolbarProps } from '../../types/habits';
import { fmtISO, shiftWeek, startOfWeek } from '../../utils/date';
import { dateFromISO } from '../../utils/dailySections';
import { ButtonGroup } from '../ui/ButtonGroup';
import { DateNav } from '../toolbar/DateNav';
import { PageToolbar } from '../toolbar/PageToolbar';
import { DotsConnectedIcon } from './DotsConnectedIcon';

/**
 * Week navigation and the Timeline/Calendar switch. Like every page toolbar it
 * sits on the title row on desktop and above the bottom navbar on phones.
 * The calendar keeps its own month strip, so it gets no date navigation here.
 */
export function HabitsToolbar({ view, onViewChange, weekAnchor, today, weekStart, onWeekChange, onToday, onMonthShift }: HabitsToolbarProps) {
  const { t } = useI18n();

  const from = startOfWeek(weekAnchor, weekStart);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);

  const step = (delta: -1 | 1) => {
    if (view === 'timeline') onWeekChange(shiftWeek(weekAnchor, delta));
    else onMonthShift(delta);
  };

  usePageShortcuts((action) => {
    if (action === 'view:today') onToday();
    else if (action === 'view:previous') step(-1);
    else if (action === 'view:next') step(1);
  });

  return (
    <PageToolbar
      nav={view === 'timeline'
        ? (density) => (
          <DateNav
            from={fmtISO(from)}
            to={fmtISO(to)}
            today={fmtISO(today)}
            weekStart={weekStart}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            onToday={onToday}
            onPick={(iso) => onWeekChange(dateFromISO(iso))}
            compact={density >= 1}
            hideToday={density >= 2}
          />
        )
        : undefined}
      view={() => (
        <ButtonGroup
          mode="single"
          value={view}
          onChange={onViewChange}
          size="xs"
          items={[
            { value: 'timeline', label: t('page.timelineView'), icon: <DotsConnectedIcon size={12} strokeWidth={1.8} /> },
            { value: 'calendar', label: t('page.calendarView'), icon: <Calendar size={12} strokeWidth={1.8} /> },
          ]}
        />
      )}
    />
  );
}
