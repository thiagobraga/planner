import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ContextMenu } from '../ui/ContextMenu';
import { MonthSelector, type MonthSelectorHandle } from '../monthly/MonthSelector';
import { StripNavigator } from '../ui/StripNavigator';
import { HabitDot, dotAriaProps } from './HabitDot';
import { HabitNameInput } from './HabitNameInput';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { HabitDragHandle } from './HabitDragHandle';
import { HabitBlockPreview } from './HabitBlockPreview';
import { fmtISO } from '../../utils/date';
import { dayState, flattenHabits, type HabitNode, type HabitSections } from '../../utils/habitTree';
import { usePlannerDrag } from '../../contexts/PlannerDragContext';
import {
  flattenHabitRows,
  projectHabitMove,
  containerForGroup,
  HABIT_INDENT_WIDTH,
  UNGROUPED_CONTAINER,
} from '../../utils/habitProjection';
import type { HabitDragData, HabitGroupDragData, HabitSectionDropData } from '../../types/drag';
import type { ApiHabitGroup } from '../../api/client';

const CELL_W = 24;
// Keep the label column on a 24px multiple so the day grid aligns with the
// app's dotted paper background.
const LABEL_COL_W = 216;
const INDENT = 24;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type HabitEditTarget = { kind: 'habit' | 'group'; id: string };

// Every row is one 24px band. Labels and day cells render from this same list so
// the two columns cannot drift out of alignment.
type TimelineRow =
  | { key: string; kind: 'group-header'; group: ApiHabitGroup }
  | { key: string; kind: 'habit'; node: HabitNode; depth: number; groupId: string | null }
  | { key: string; kind: 'add-habit'; groupId: string | null }
  | { key: string; kind: 'spacer' }
  | { key: string; kind: 'add-group' };

/**
 * One drop region of the label column.
 *
 * Rows are grouped into sections so a habit can be dropped into a group that has
 * no rows to aim at. The day-grid column re-flattens these back into one list,
 * so both columns still render exactly the same bands in the same order.
 */
interface TimelineSection {
  key: string;
  /** Null for the ungrouped list; absent entirely for the trailing add-group area. */
  groupId: string | null;
  /** The tail section holds only chrome and accepts nothing. */
  droppable: boolean;
  rows: TimelineRow[];
}

export interface HabitTimelineProps {
  sections: HabitSections;
  today: Date;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  todaySignal?: number;
  editing?: HabitEditTarget;
  collapsed: ReadonlySet<string>;
  /** The habit or group currently being dragged, so its block can be collapsed. */
  activeDragId?: string | null;
  onToggleCollapse: (id: string) => void;
  onToggleDay: (node: HabitNode, iso: string) => void;
  onStartEdit: (target: HabitEditTarget) => void;
  onCommitEdit: (target: HabitEditTarget, name: string) => void;
  onCancelEdit: (target: HabitEditTarget) => void;
  onAddHabit: (options: { groupId: string | null; parentId?: string }) => void;
  onAddGroup: () => void;
  onToggleGroupIcon: (id: string) => void;
  onDelete: (target: HabitEditTarget) => void;
}

interface DayCell {
  iso: string;
  letter: string;
  dayOfMonth: number;
  future: boolean;
  isWeekend: boolean;
}

/**
 * A day's mark and whether it joins the run either side of it.
 *
 * Any day with progress is part of the chain, so a partly-done parent day links
 * rather than breaking the run. Shared by the live row and the drag preview so
 * a habit lifted off the list draws the same chain it drew in place.
 */
function dayLink(node: HabitNode, days: DayCell[], i: number) {
  const state = dayState(node, days[i]!.iso);
  const linked = state !== 'empty';
  return {
    state,
    prevLinked: i > 0 && linked && dayState(node, days[i - 1]!.iso) !== 'empty',
    nextLinked:
      i < days.length - 1 &&
      linked &&
      !days[i + 1]!.future &&
      dayState(node, days[i + 1]!.iso) !== 'empty',
  };
}

// Horizontal habit tracker for one month: one row per habit, one column per day.
// Sub-habits sit indented under their parent, and the parent shows their combined
// state - empty, half, or full.
export function HabitTimeline({
  sections,
  today,
  year,
  month,
  onMonthChange,
  todaySignal,
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
}: HabitTimelineProps) {
  const [menu, setMenu] = useState<{ target: HabitEditTarget; canAddSub: boolean; x: number; y: number } | null>(null);
  const daysViewportRef = useRef<HTMLDivElement>(null);
  const daysHeaderViewportRef = useRef<HTMLDivElement>(null);
  const monthSelectorRef = useRef<MonthSelectorHandle>(null);
  const [canPagePrevious, setCanPagePrevious] = useState(false);
  const [canPageNext, setCanPageNext] = useState(false);
  const { indentSteps, overId, setOverlayNode } = usePlannerDrag();

  const days = useMemo<DayCell[]>(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const dow = date.getDay();
      return {
        iso: fmtISO(date),
        letter: DAY_LETTERS[dow],
        dayOfMonth: i + 1,
        future: date.getTime() > today.getTime(),
        isWeekend: dow === 0 || dow === 6,
      };
    });
  }, [year, month, today]);

  const todayISO = fmtISO(today);

  // Weekend/today tint always applies; future columns additionally dim so every
  // future day - weekend or not - fades by the same uniform amount.
  const dayColClass = useCallback(
    (d: DayCell) =>
      `${d.isWeekend ? 'habit-timeline-weekend-col' : ''} ${d.iso === todayISO ? 'habit-timeline-today-col' : ''} ${d.future ? 'opacity-40' : ''
      }`,
    [todayISO],
  );

  const timelineSections = useMemo<TimelineSection[]>(() => {
    // A dragged parent's sub-habits are pulled out of the list for the duration
    // of the drag, exactly as the task list does: dnd-kit sorts each row on its
    // own, so leaving them behind would strand them under the wrong parent while
    // the block is in flight. The overlay's "+N" stands in for them.
    const carried = new Set<string>();
    if (activeDragId) {
      const dragged = [...sections.ungrouped, ...sections.groups.flatMap((s) => s.habits)].find(
        (node) => node.id === activeDragId,
      );
      for (const child of dragged?.children ?? []) carried.add(child.id);
    }

    const habitRows = (nodes: HabitNode[], groupId: string | null): TimelineRow[] => {
      const out: TimelineRow[] = [];
      for (const { node, depth } of flattenHabits(nodes)) {
        // A collapsed parent hides its sub-habits but keeps its own row.
        if (depth > 0 && node.parentId && collapsed.has(node.parentId)) continue;
        if (carried.has(node.id)) continue;
        out.push({ key: `habit-${node.id}`, kind: 'habit', node, depth, groupId });
      }
      return out;
    };

    const out: TimelineSection[] = [
      {
        key: UNGROUPED_CONTAINER,
        groupId: null,
        droppable: true,
        rows: [
          ...habitRows(sections.ungrouped, null),
          { key: 'add-habit-root', kind: 'add-habit', groupId: null },
        ],
      },
    ];

    for (const section of sections.groups) {
      out.push({
        key: section.group.id,
        groupId: section.group.id,
        droppable: true,
        rows: [
          { key: `spacer-${section.group.id}`, kind: 'spacer' },
          { key: `group-${section.group.id}`, kind: 'group-header', group: section.group },
          ...habitRows(section.habits, section.group.id),
          { key: `add-habit-${section.group.id}`, kind: 'add-habit', groupId: section.group.id },
        ],
      });
    }

    out.push({
      key: 'timeline-tail',
      groupId: null,
      droppable: false,
      rows: [
        { key: 'spacer-add-group', kind: 'spacer' },
        { key: 'add-group', kind: 'add-group' },
      ],
    });

    return out;
  }, [sections, collapsed, activeDragId]);

  // The day grid renders the same bands in the same order, flattened back out.
  const rows = useMemo<TimelineRow[]>(
    () => timelineSections.flatMap((section) => section.rows),
    [timelineSections],
  );

  // Everything the shared DndContext can address in this view: habit rows to
  // reorder against, and group headers to move whole groups.
  const sortableIds = useMemo(
    () =>
      rows
        .filter((row) => row.kind === 'habit' || row.kind === 'group-header')
        .map((row) => (row.kind === 'habit' ? row.node.id : row.kind === 'group-header' ? row.group.id : '')),
    [rows],
  );

  // Where the block would land, previewed as an insertion line. The timeline is
  // a two-column grid, so rows deliberately do not slide out of the way - only
  // the label column could move, and the day cells would fall out of step.
  const dragRows = useMemo(() => flattenHabitRows(sections), [sections]);
  const projection =
    activeDragId && overId && dragRows.some((r) => r.id === activeDragId)
      ? projectHabitMove(
          dragRows,
          activeDragId,
          Math.max(0, dragRows.findIndex((r) => r.id === overId)),
          indentSteps * HABIT_INDENT_WIDTH,
        )
      : null;

  // The row the line is drawn above: the first sibling at or after the projected
  // position within the target scope.
  const insertionBeforeId = useMemo(() => {
    if (!projection || !activeDragId) return null;
    const siblings = dragRows.filter(
      (row) =>
        row.id !== activeDragId &&
        (projection.parentId
          ? row.parentId === projection.parentId
          : row.depth === 0 && row.groupId === projection.groupId),
    );
    return siblings[projection.position]?.id ?? null;
  }, [projection, activeDragId, dragRows]);

  // What travels under the pointer: the dragged habit drawn as a whole row -
  // label, marks and all - together with the sub-habits it carries. A group
  // header has no day track of its own, so it lifts as its heading.
  const draggedBlock = useMemo(() => {
    if (!activeDragId) return null;

    const roots = [...sections.ungrouped, ...sections.groups.flatMap((s) => s.habits)];
    const found = findNodeWithDepth(roots, activeDragId);
    if (!found) return null;

    // A collapsed parent's sub-habits are not on screen, so they do not travel.
    const carried = collapsed.has(found.node.id) ? [] : found.node.children;
    return [found, ...carried.map((child) => ({ node: child, depth: found.depth + 1 }))];
  }, [sections, activeDragId, collapsed]);

  useEffect(() => {
    if (!activeDragId) return;

    if (!draggedBlock) {
      const group = sections.groups.find((s) => s.group.id === activeDragId);
      if (!group) return;
      setOverlayNode(
        <HabitBlockPreview
          name={group.group.name}
          icon={group.group.icon}
          count={group.habits.length}
          kind="habit-group"
        />,
      );
      return () => setOverlayNode(null);
    }

    const viewport = daysViewportRef.current;
    setOverlayNode(
      <HabitTimelineBlockPreview
        rows={draggedBlock}
        days={days}
        dayColClass={dayColClass}
        scrollLeft={viewport?.scrollLeft ?? 0}
        trackWidth={viewport?.clientWidth ?? 0}
      />,
    );
    return () => setOverlayNode(null);
  }, [activeDragId, draggedBlock, sections, days, dayColClass, setOverlayNode]);

  useEffect(() => {
    if (todaySignal) {
      if (monthSelectorRef.current) {
        monthSelectorRef.current.animateTo(today.getFullYear(), today.getMonth());
      } else {
        onMonthChange(today.getFullYear(), today.getMonth());
      }
    }
    // onMonthChange is intentionally omitted: this fires on an explicit signal only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaySignal, today]);

  const updatePagingState = useCallback(() => {
    const viewport = daysViewportRef.current;
    if (!viewport) return;

    if (daysHeaderViewportRef.current) {
      daysHeaderViewportRef.current.scrollLeft = viewport.scrollLeft;
    }
    setCanPagePrevious(viewport.scrollLeft > 1);
    setCanPageNext(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const viewport = daysViewportRef.current;
    if (!viewport) return;

    const todayIndex = days.findIndex((d) => d.iso === todayISO);
    if (todayIndex !== -1) {
      const centerLeft = todayIndex * CELL_W + CELL_W / 2 - viewport.clientWidth / 2;
      const snapLeft = Math.round(Math.max(0, centerLeft) / CELL_W) * CELL_W;
      viewport.scrollTo({ left: snapLeft });
    } else {
      viewport.scrollTo({ left: 0 });
    }
    updatePagingState();

    const resizeObserver = new ResizeObserver(updatePagingState);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [days, todayISO, todaySignal, updatePagingState]);

  const pageDays = (direction: -1 | 1) => {
    const viewport = daysViewportRef.current;
    if (!viewport) return;

    const visibleCells = Math.max(1, Math.floor(viewport.clientWidth / CELL_W));
    viewport.scrollBy({ left: direction * visibleCells * CELL_W, behavior: 'smooth' });
  };

  const isEditing = (kind: 'habit' | 'group', id: string) =>
    editing?.kind === kind && editing.id === id;

  const menuGroup = menu?.target.kind === 'group'
    ? sections.groups.find((section) => section.group.id === menu.target.id)?.group
    : undefined;

  return (
    <div className="habit-timeline">
      <div className="habit-timeline-selectors-sticky">
        <MonthSelector
          ref={monthSelectorRef}
          year={year}
          month={month}
          onChange={onMonthChange}
        />

        <div className="habit-timeline-day-selector mt-6 flex min-w-0 items-start gap-0">
          <div className="h-12 shrink-0 min-w-0" style={{ width: LABEL_COL_W }} aria-hidden="true" />

          <StripNavigator
            direction="previous"
            aria-label="Previous days"
            disabled={!canPagePrevious}
            onClick={() => pageDays(-1)}
            className="habit-timeline-days-prev"
          />

          <div
            ref={daysHeaderViewportRef}
            className="habit-timeline-days-header-viewport min-w-0 flex-1 overflow-hidden"
          >
            <div className="habit-timeline-header flex h-12" style={{ width: days.length * CELL_W }}>
              {days.map((d) => (
                <div
                  key={d.iso}
                  className={`habit-timeline-header-day flex h-12 shrink-0 flex-col items-center justify-center ${dayColClass(
                    d,
                  )}`}
                  style={{ width: CELL_W }}
                >
                  <span className="habit-timeline-header-day-letter block h-6 w-full text-center text-[10px] leading-[24px] text-ink-light opacity-70">
                    {d.letter}
                  </span>
                  <span
                    className={`habit-timeline-header-day-number block h-6 w-full text-center text-[10px] leading-[24px] ${d.iso === todayISO ? 'text-ink font-semibold' : 'text-ink-light'
                      }`}
                  >
                    {d.dayOfMonth}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <StripNavigator
            direction="next"
            aria-label="Next days"
            disabled={!canPageNext}
            onClick={() => pageDays(1)}
            className="habit-timeline-days-next"
          />
        </div>
      </div>

      <div className="habit-timeline-table min-w-0">
        <div className="habit-timeline-body flex min-w-0 items-start gap-0">
          <div className="habit-timeline-labels shrink-0 min-w-0" style={{ width: LABEL_COL_W }}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {timelineSections.map((section) => (
              <TimelineSectionDrop
                key={section.key}
                groupId={section.groupId}
                droppable={section.droppable}
              >
            {section.rows.map((row) => {
              if (row.kind === 'spacer') {
                return <div key={row.key} className="h-6" aria-hidden="true" />;
              }

            if (row.kind === 'add-group') {
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={onAddGroup}
                  className="habit-timeline-add-group group flex h-6 w-full min-w-0 items-center pr-2 text-ink-light transition-colors hover:text-ink"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <Plus size={14} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-sm leading-6">New group</span>
                </button>
              );
            }

            if (row.kind === 'add-habit') {
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => onAddHabit({ groupId: row.groupId })}
                  className="habit-timeline-add-habit group flex h-6 w-full min-w-0 items-center pr-2 text-ink-light transition-colors hover:text-ink"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <Plus size={14} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-sm leading-6">New habit</span>
                </button>
              );
            }

            if (row.kind === 'group-header') {
              const target: HabitEditTarget = { kind: 'group', id: row.group.id };
              return (
                <SortableGroupHeader
                  key={row.key}
                  group={row.group}
                  dimmed={activeDragId === row.group.id}
                >
                  {row.group.icon && (
                    <span
                      aria-hidden="true"
                      className="habit-group-icon flex h-6 w-6 shrink-0 items-center justify-center text-sm leading-6 normal-case tracking-normal"
                    >
                      {row.group.icon}
                    </span>
                  )}
                  {isEditing('group', row.group.id) ? (
                    <HabitNameInput
                      defaultValue={row.group.name}
                      className="uppercase tracking-[0.1em] text-[10px] font-semibold text-ink-light"
                      onCommit={(name) => onCommitEdit(target, name)}
                      onCancel={() => onCancelEdit(target)}
                    />
                  ) : (
                    <>
                      <span
                        className="habit-timeline-group-name min-w-0 flex-1 cursor-text truncate text-[10px] font-semibold uppercase leading-6 tracking-[0.1em] text-ink-light"
                        onDoubleClick={() => onStartEdit(target)}
                      >
                        {row.group.name}
                      </span>
                      <RowOptionsButton
                        label={`Options for ${row.group.name}`}
                        onOpen={(x, y) => setMenu({ target, canAddSub: false, x, y })}
                      />
                    </>
                  )}
                </SortableGroupHeader>
              );
            }

            const { node, depth } = row;
            const target: HabitEditTarget = { kind: 'habit', id: node.id };
            const hasChildren = node.children.length > 0;
            const isCollapsed = collapsed.has(node.id);

            return (
              <SortableHabitLabelRow
                key={row.key}
                node={node}
                depth={depth}
                groupId={row.groupId}
                indent={INDENT}
                dimmed={activeDragId === node.id}
                showInsertionBefore={insertionBeforeId === node.id}
                insertionDepth={projection?.depth ?? 0}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
                    aria-expanded={!isCollapsed}
                    onClick={() => onToggleCollapse(node.id)}
                    {...{ [NO_DRAG_ATTR]: '' }}
                    className="habit-timeline-row-disclosure flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-ink-light hover:text-ink"
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <span
                      className="habit-timeline-row-color-dot h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--color-ink-lighter)' }}
                      aria-hidden="true"
                    />
                  </span>
                )}

                {isEditing('habit', node.id) ? (
                  <HabitNameInput
                    defaultValue={node.name}
                    placeholder="Habit name"
                    onCommit={(name) => onCommitEdit(target, name)}
                    onCancel={() => onCancelEdit(target)}
                  />
                ) : (
                  <>
                    <span
                      className="habit-timeline-row-name min-w-0 flex-1 cursor-text truncate text-sm leading-6 text-ink"
                      onDoubleClick={() => onStartEdit(target)}
                    >
                      {node.name}
                    </span>
                    <RowOptionsButton
                      label={`Options for ${node.name}`}
                      onOpen={(x, y) => setMenu({ target, canAddSub: depth === 0, x, y })}
                    />
                  </>
                )}
              </SortableHabitLabelRow>
            );
            })}
              </TimelineSectionDrop>
            ))}
            </SortableContext>
          </div>

          <div className="h-6 w-6 shrink-0" aria-hidden="true" />

          <div
            ref={daysViewportRef}
            onScroll={updatePagingState}
            className="habit-timeline-days-viewport min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory"
          >
            <div className="habit-timeline-table-inner" style={{ width: days.length * CELL_W }}>
              {rows.map((row) => {
              // Non-habit rows still occupy a band so both columns stay in step,
              // and keep the weekend/today column shading unbroken top to bottom.
              if (row.kind !== 'habit') {
                return (
                  <div key={row.key} className="flex h-6" aria-hidden="true">
                    {days.map((d) => (
                      <span
                        key={d.iso}
                        className={`h-6 shrink-0 snap-start ${dayColClass(d)}`}
                        style={{ width: CELL_W }}
                      />
                    ))}
                  </div>
                );
              }

              const { node } = row;
              return (
                <div key={row.key} className="habit-timeline-row flex h-6">
                  {days.map((d, i) => {
                    if (d.future) {
                      return (
                        <span
                          key={d.iso}
                          aria-hidden="true"
                          className={`habit-timeline-day-placeholder h-6 shrink-0 snap-start ${dayColClass(d)}`}
                          style={{ width: CELL_W }}
                        />
                      );
                    }

                    const { state, prevLinked, nextLinked } = dayLink(node, days, i);

                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => onToggleDay(node, d.iso)}
                        aria-label={`${node.name} ${d.iso}`}
                        {...dotAriaProps(state)}
                        className={`habit-timeline-day-cell group relative h-6 shrink-0 snap-start cursor-pointer border-none bg-transparent p-0 ${dayColClass(
                          d,
                        )}`}
                        style={{ width: CELL_W }}
                      >
                        {prevLinked && (
                          <span
                            aria-hidden="true"
                            className="habit-timeline-day-connector-prev absolute top-1/2 left-0 h-px -translate-y-1/2"
                            style={{ width: CELL_W / 2, background: 'var(--color-ink-lighter)' }}
                          />
                        )}
                        {nextLinked && (
                          <span
                            aria-hidden="true"
                            className="habit-timeline-day-connector-next absolute top-1/2 right-0 h-px -translate-y-1/2"
                            style={{ width: CELL_W / 2, background: 'var(--color-ink-lighter)' }}
                          />
                        )}
                        <HabitDot state={state} interactive />
                      </button>
                    );
                  })}
                </div>
              );
              })}
            </div>
          </div>

          <div className="h-6 w-6 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {menu && (
        <ContextMenu
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          items={[
            { type: 'item', label: 'Rename', onClick: () => onStartEdit(menu.target) },
            ...(menu.target.kind === 'group'
              ? [
                {
                  type: 'item' as const,
                  label: menuGroup?.icon ? 'Remove icon' : 'Add icon',
                  onClick: () => onToggleGroupIcon(menu.target.id),
                },
              ]
              : []),
            ...(menu.canAddSub
              ? [
                {
                  type: 'item' as const,
                  label: 'Add sub-habit',
                  onClick: () => onAddHabit({ groupId: null, parentId: menu.target.id }),
                },
              ]
              : []),
            { type: 'separator' },
            {
              type: 'item',
              label: menu.target.kind === 'group' ? 'Delete group' : 'Delete',
              destructive: true,
              onClick: () => onDelete(menu.target),
            },
          ]}
        />
      )}
    </div>
  );
}

/**
 * One drop region of the label column - the ungrouped list, or one group.
 *
 * Registered even when it holds no habits, because an empty group has no row to
 * aim at and would otherwise be unreachable by drag.
 */
function TimelineSectionDrop({
  groupId,
  droppable,
  children,
}: {
  groupId: string | null;
  droppable: boolean;
  children: ReactNode;
}) {
  const data: HabitSectionDropData = { kind: 'habit-section', groupId };
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${containerForGroup(groupId)}`,
    data,
    disabled: !droppable,
  });

  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      data-drop-target={isOver ? 'true' : undefined}
      className={`habit-timeline-section ${isOver ? 'habit-timeline-section--drop-target' : ''}`}
    >
      {children}
    </div>
  );
}

/** Locate a habit anywhere in the tree, keeping the depth it renders at. */
function findNodeWithDepth(
  nodes: HabitNode[],
  id: string,
  depth = 0,
): { node: HabitNode; depth: number } | null {
  for (const node of nodes) {
    if (node.id === id) return { node, depth };
    const found = findNodeWithDepth(node.children, id, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The dragged habit and the sub-habits it carries, drawn as whole rows. */
interface TimelineBlockPreviewProps {
  rows: { node: HabitNode; depth: number }[];
  days: DayCell[];
  dayColClass: (day: DayCell) => string;
  /** How far the days viewport is scrolled, so the marks line up under the row. */
  scrollLeft: number;
  /** Visible width of the days viewport; the track is clipped to it. */
  trackWidth: number;
}

/**
 * The dragged habit rows, drawn as they appear in the timeline, for the overlay.
 *
 * Deliberately not the row components: those register sortable hooks and own
 * edit state, none of which belongs to a copy floating under the pointer. The
 * day cells are spans rather than buttons here for the same reason.
 *
 * The timeline splits one row across two columns - a fixed label column and a
 * horizontally scrolled days viewport - so the preview rebuilds that geometry
 * itself: label column, the 24px gutter between them, then the track shifted by
 * the viewport's own scroll offset and clipped to its width. Without that shift
 * the marks would sit under the wrong days the moment the month is scrolled.
 */
function HabitTimelineBlockPreview({
  rows,
  days,
  dayColClass,
  scrollLeft,
  trackWidth,
}: TimelineBlockPreviewProps) {
  const base = rows[0]?.depth ?? 0;

  return (
    <div className="habit-timeline-block-preview" aria-hidden>
      {rows.map(({ node, depth }) => (
        <div key={node.id} className="flex h-6 items-start">
          <div
            className="habit-timeline-row-label flex h-6 min-w-0 shrink-0 items-center pr-2"
            // Depths are relative to the block, so a sub-habit dragged out of
            // level 1 draws flush rather than indented into empty space.
            style={{ width: LABEL_COL_W, paddingLeft: Math.max(0, depth - base) * INDENT }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <span
                className="habit-timeline-row-color-dot h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--color-ink-lighter)' }}
              />
            </span>
            <span className="habit-timeline-row-name min-w-0 flex-1 truncate text-sm leading-6 text-ink">
              {node.name}
            </span>
          </div>

          <div className="h-6 w-6 shrink-0" />

          <div className="h-6 overflow-hidden" style={{ width: trackWidth }}>
            <div
              className="flex h-6"
              style={{ width: days.length * CELL_W, transform: `translateX(${-scrollLeft}px)` }}
            >
              {days.map((d, i) => {
                if (d.future) {
                  return (
                    <span
                      key={d.iso}
                      className={`habit-timeline-day-placeholder h-6 shrink-0 ${dayColClass(d)}`}
                      style={{ width: CELL_W }}
                    />
                  );
                }

                const { state, prevLinked, nextLinked } = dayLink(node, days, i);
                return (
                  <span
                    key={d.iso}
                    className={`habit-timeline-day-cell relative h-6 shrink-0 ${dayColClass(d)}`}
                    style={{ width: CELL_W }}
                  >
                    {prevLinked && (
                      <span
                        className="habit-timeline-day-connector-prev absolute top-1/2 left-0 h-px -translate-y-1/2"
                        style={{ width: CELL_W / 2, background: 'var(--color-ink-lighter)' }}
                      />
                    )}
                    {nextLinked && (
                      <span
                        className="habit-timeline-day-connector-next absolute top-1/2 right-0 h-px -translate-y-1/2"
                        style={{ width: CELL_W / 2, background: 'var(--color-ink-lighter)' }}
                      />
                    )}
                    <HabitDot state={state} />
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A habit label row, draggable through the shared context.
 *
 * Deliberately does not apply dnd-kit's transform. The timeline is two columns
 * driven by one row list, and only this column would move - the day cells would
 * slide out of step with their own habit. The insertion line previews the
 * landing position instead.
 */
function SortableHabitLabelRow({
  node,
  depth,
  groupId,
  indent,
  dimmed,
  showInsertionBefore,
  insertionDepth,
  children,
}: {
  node: HabitNode;
  depth: number;
  groupId: string | null;
  indent: number;
  dimmed: boolean;
  showInsertionBefore: boolean;
  insertionDepth: number;
  children: ReactNode;
}) {
  const childIds = node.children.map((c) => c.id);
  const data = (
    depth === 0
      ? {
          kind: 'habit',
          habitId: node.id,
          parentId: null,
          groupId,
          containerId: containerForGroup(groupId),
          childIds,
        }
      : {
          kind: 'habit',
          habitId: node.id,
          parentId: node.parentId!,
          groupId: null,
          // The section is the parent's, which a sub-habit's own null groupId
          // cannot name.
          containerId: containerForGroup(groupId),
          childIds: [],
        }
  ) as HabitDragData;

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: node.id, data });

  return (
    <>
      {showInsertionBefore && (
        <div
          aria-hidden="true"
          className="habit-timeline-insertion relative h-0"
          style={{ marginLeft: insertionDepth * indent }}
        >
          <span className="absolute inset-x-0 -top-px block h-px bg-ink" />
        </div>
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{ paddingLeft: depth * indent, opacity: isDragging || dimmed ? 0.4 : 1 }}
        className="habit-timeline-row-label group flex h-6 min-w-0 items-center pr-2"
        aria-label={node.name}
      >
        <HabitDragHandle label={node.name} />
        {children}
      </div>
    </>
  );
}

/** A group header, draggable to reorder whole groups. */
function SortableGroupHeader({
  group,
  dimmed,
  children,
}: {
  group: ApiHabitGroup;
  dimmed: boolean;
  children: ReactNode;
}) {
  const data: HabitGroupDragData = { kind: 'habit-group', groupId: group.id };
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: group.id, data });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging || dimmed ? 0.4 : 1 }}
      className="habit-timeline-group-header group flex h-6 min-w-0 items-center pr-2"
      aria-label={group.name}
    >
      <HabitDragHandle label={group.name} />
      {children}
    </div>
  );
}

function RowOptionsButton({ label, onOpen }: { label: string; onOpen: (x: number, y: number) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...{ [NO_DRAG_ATTR]: '' }}
      className="habit-timeline-row-options flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-ink-light opacity-0 transition-opacity duration-75 hover:bg-dot/30 hover:text-ink focus:opacity-100 group-hover:opacity-100"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onOpen(rect.left, rect.bottom + 4);
      }}
    >
      <MoreHorizontal size={14} />
    </button>
  );
}
