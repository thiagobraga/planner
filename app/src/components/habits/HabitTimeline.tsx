import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { ContextMenu } from '../ui/ContextMenu';
import { MonthSelector, type MonthSelectorHandle } from '../monthly/MonthSelector';
import { StripNavigator } from '../ui/StripNavigator';
import { HabitDot, dotAriaProps } from './HabitDot';
import { fmtISO } from '../../utils/date';
import { dayState, flattenHabits, type HabitNode, type HabitSections } from '../../utils/habitTree';
import type { ApiHabitGroup } from '../../api/client';

const CELL_W = 24;
const INDENT = 24;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type HabitEditTarget = { kind: 'habit' | 'group'; id: string };

// Every row is one 24px band. Labels and day cells render from this same list so
// the two columns cannot drift out of alignment.
type TimelineRow =
  | { key: string; kind: 'group-header'; group: ApiHabitGroup }
  | { key: string; kind: 'habit'; node: HabitNode; depth: number }
  | { key: string; kind: 'add-habit'; groupId: string | null }
  | { key: string; kind: 'spacer' }
  | { key: string; kind: 'add-group' };

export interface HabitTimelineProps {
  sections: HabitSections;
  today: Date;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  todaySignal?: number;
  editing?: HabitEditTarget;
  onToggleDay: (node: HabitNode, iso: string) => void;
  onStartEdit: (target: HabitEditTarget) => void;
  onCommitEdit: (target: HabitEditTarget, name: string) => void;
  onCancelEdit: (target: HabitEditTarget) => void;
  onAddHabit: (options: { groupId: string | null; parentId?: string }) => void;
  onAddGroup: () => void;
  onDelete: (target: HabitEditTarget) => void;
}

interface DayCell {
  iso: string;
  letter: string;
  dayOfMonth: number;
  future: boolean;
  isWeekend: boolean;
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
  onToggleDay,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onAddHabit,
  onAddGroup,
  onDelete,
}: HabitTimelineProps) {
  const [menu, setMenu] = useState<{ target: HabitEditTarget; canAddSub: boolean; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const daysViewportRef = useRef<HTMLDivElement>(null);
  const daysHeaderViewportRef = useRef<HTMLDivElement>(null);
  const monthSelectorRef = useRef<MonthSelectorHandle>(null);
  const [canPagePrevious, setCanPagePrevious] = useState(false);
  const [canPageNext, setCanPageNext] = useState(false);

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

  const rows = useMemo<TimelineRow[]>(() => {
    const out: TimelineRow[] = [];

    const pushHabits = (nodes: HabitNode[]) => {
      for (const { node, depth } of flattenHabits(nodes)) {
        // A collapsed parent hides its sub-habits but keeps its own row.
        if (depth > 0 && node.parentId && collapsed.has(node.parentId)) continue;
        out.push({ key: `habit-${node.id}`, kind: 'habit', node, depth });
      }
    };

    pushHabits(sections.ungrouped);
    out.push({ key: 'add-habit-root', kind: 'add-habit', groupId: null });

    for (const section of sections.groups) {
      out.push({ key: `spacer-${section.group.id}`, kind: 'spacer' });
      out.push({ key: `group-${section.group.id}`, kind: 'group-header', group: section.group });
      pushHabits(section.habits);
      out.push({ key: `add-habit-${section.group.id}`, kind: 'add-habit', groupId: section.group.id });
    }

    out.push({ key: 'spacer-add-group', kind: 'spacer' });
    out.push({ key: 'add-group', kind: 'add-group' });
    return out;
  }, [sections, collapsed]);

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

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isEditing = (kind: 'habit' | 'group', id: string) =>
    editing?.kind === kind && editing.id === id;

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
          <div className="h-12 w-56 min-w-0 shrink-0" aria-hidden="true" />

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
          <div className="habit-timeline-labels w-56 shrink-0 min-w-0">
            {rows.map((row) => {
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
                <div
                  key={row.key}
                  className="habit-timeline-group-header group flex h-6 min-w-0 items-center pr-2"
                >
                  {isEditing('group', row.group.id) ? (
                    <RowNameInput
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
                </div>
              );
            }

            const { node, depth } = row;
            const target: HabitEditTarget = { kind: 'habit', id: node.id };
            const hasChildren = node.children.length > 0;
            const isCollapsed = collapsed.has(node.id);

            return (
              <div
                key={row.key}
                className="habit-timeline-row-label group flex h-6 min-w-0 items-center pr-2"
                style={{ paddingLeft: depth * INDENT }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleCollapse(node.id)}
                    className="habit-timeline-row-disclosure flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-ink-light hover:text-ink"
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <span
                      className="habit-timeline-row-color-dot h-2 w-2 rounded-full"
                      style={{ background: 'var(--color-ink-lighter)' }}
                      aria-hidden="true"
                    />
                  </span>
                )}

                {isEditing('habit', node.id) ? (
                  <RowNameInput
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
              </div>
            );
            })}
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

                    const state = dayState(node, d.iso);
                    // Any day with progress is part of the chain, so partly-done
                    // parent days link rather than breaking the run.
                    const linked = state !== 'empty';
                    const prevLinked = i > 0 && linked && dayState(node, days[i - 1].iso) !== 'empty';
                    const nextLinked =
                      i < days.length - 1 &&
                      linked &&
                      !days[i + 1].future &&
                      dayState(node, days[i + 1].iso) !== 'empty';

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

function RowOptionsButton({ label, onOpen }: { label: string; onOpen: (x: number, y: number) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
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

interface RowNameInputProps {
  defaultValue: string;
  placeholder?: string;
  className?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

// Swap-to-input rename, following the task row pattern: Enter commits, Escape
// cancels, and blur commits once. committedRef stops blur from firing a second
// commit after Enter has already handled it.
function RowNameInput({ defaultValue, placeholder, className = '', onCommit, onCancel }: RowNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const commit = (value: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(value.trim());
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      placeholder={placeholder}
      spellCheck={false}
      className={`habit-timeline-row-name-input task-input min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-6 text-ink outline-none ${className}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit(event.currentTarget.value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          committedRef.current = true;
          onCancel();
        }
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
    />
  );
}
