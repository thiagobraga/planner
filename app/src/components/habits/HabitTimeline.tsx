import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHabitTimelineDrag } from '../../hooks/useHabitTimelineDrag';
import { useI18n } from '../../i18n/I18nContext';
import type { HabitTimelineProps, TimelineDayCell, TimelineMenuState } from '../../types/habitTimeline';
import { buildWeekDays, fmtISO, weekdayInitials } from '../../utils/date';
import { buildTimelineSections, labelColumnWidth, timelineSortableIds } from '../../utils/habitTimeline';
import { HabitTimelineDayGrid } from './HabitTimelineDayGrid';
import { HabitTimelineDayHeader } from './HabitTimelineDayHeader';
import { HabitTimelineLabels } from './HabitTimelineLabels';
import { HabitTimelineMenu } from './HabitTimelineMenu';

// Horizontal habit tracker for one week: one row per habit, one column per day,
// always exactly 7 columns aligned to the weekStart preference. The week itself
// is picked in the page toolbar.
// Sub-habits sit indented under their parent, and the parent shows their combined
// state - empty, half, or full.
export function HabitTimeline({
  sections,
  today,
  weekStart,
  weekAnchor,
  editing,
  collapsed,
  activeDragId,
  onToggleCollapse,
  onToggleDay,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onAddHabit,
  onAddGroup,
  onToggleGroupIcon,
  onDelete,
  onArchive,
}: HabitTimelineProps) {
  const { locale } = useI18n();
  const [menu, setMenu] = useState<TimelineMenuState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState<number | null>(null);
  const labelColWidth = labelColumnWidth(timelineWidth);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setTimelineWidth(width);
    });

    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const dayLetters = weekdayInitials(weekStart, locale);
  const days = useMemo<TimelineDayCell[]>(
    () =>
      buildWeekDays(weekAnchor, today, weekStart).map((d, i) => ({
        iso: d.iso,
        letter: dayLetters[i]!,
        dayOfMonth: d.dayOfMonth,
        future: d.future,
        isWeekend: d.weekday === 0 || d.weekday === 6,
      })),
    [dayLetters, weekAnchor, today, weekStart],
  );

  const todayISO = fmtISO(today);
  const dayColClass = useCallback(
    (d: TimelineDayCell) =>
      `${d.isWeekend ? 'habit-timeline-weekend-col' : ''} ${d.iso === todayISO ? 'habit-timeline-today-col' : ''}`,
    [todayISO],
  );

  const timelineSections = useMemo(
    () => buildTimelineSections(sections, collapsed, activeDragId),
    [sections, collapsed, activeDragId],
  );
  // The day grid renders the same bands in the same order, flattened back out.
  const rows = useMemo(() => timelineSections.flatMap((section) => section.rows), [timelineSections]);
  const sortableIds = useMemo(() => timelineSortableIds(rows), [rows]);

  const { insertionBeforeId, insertionDepth } = useHabitTimelineDrag({
    sections,
    collapsed,
    activeDragId,
    days,
    dayColClass,
    labelColWidth,
  });

  const menuGroup =
    menu?.target.kind === 'group'
      ? sections.groups.find((section) => section.group.id === menu.target.id)?.group
      : undefined;

  return (
    <div ref={rootRef} className="habit-timeline">
      <HabitTimelineDayHeader days={days} dayColClass={dayColClass} labelColWidth={labelColWidth} todayISO={todayISO} />

      <div className="habit-timeline-table min-w-0">
        <div className="habit-timeline-body flex min-w-0 items-start gap-0">
          <HabitTimelineLabels
            sections={timelineSections}
            sortableIds={sortableIds}
            width={labelColWidth}
            editing={editing}
            collapsed={collapsed}
            activeDragId={activeDragId}
            insertionBeforeId={insertionBeforeId}
            insertionDepth={insertionDepth}
            onOpenMenu={setMenu}
            onToggleCollapse={onToggleCollapse}
            onStartEdit={onStartEdit}
            onCommitEdit={onCommitEdit}
            onCancelEdit={onCancelEdit}
            onAddHabit={onAddHabit}
            onAddGroup={onAddGroup}
          />
          <HabitTimelineDayGrid rows={rows} days={days} dayColClass={dayColClass} onToggleDay={onToggleDay} />
        </div>
      </div>

      {menu && (
        <HabitTimelineMenu
          menu={menu}
          groupHasIcon={Boolean(menuGroup?.icon)}
          onClose={() => setMenu(null)}
          onStartEdit={onStartEdit}
          onToggleGroupIcon={onToggleGroupIcon}
          onAddHabit={onAddHabit}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
