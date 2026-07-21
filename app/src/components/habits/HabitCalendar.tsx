import { useEffect, useMemo, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { MonthSelector } from '../monthly/MonthSelector';
import { HabitMonthGrid } from './HabitMonthGrid';
import { HabitNameInput } from './HabitNameInput';
import { HabitDragHandle } from './HabitDragHandle';
import { HabitBlockPreview } from './HabitBlockPreview';
import { usePlannerDrag } from '../../contexts/PlannerDragContext';
import { dayState, type HabitNode, type HabitSections } from '../../utils/habitTree';
import { containerForGroup } from '../../utils/habitProjection';
import type { HabitDragData, HabitGroupDragData, HabitSectionDropData } from '../../types/drag';
import type { HabitEditTarget } from './HabitTimeline';
import type { ApiHabitGroup } from '../../api/client';
import type { WeekStart } from '../../utils/date';

/** One card column, which the grid and the drag preview both size from. */
const CARD_W = 192;

export interface HabitCalendarProps {
  sections: HabitSections;
  today: Date;
  year: number;
  month: number;
  weekStart: WeekStart;
  onMonthChange: (year: number, month: number) => void;
  onToggleDay: (node: HabitNode, iso: string) => void;
  editing?: HabitEditTarget;
  /** The habit or group currently being dragged, so its card can dim. */
  activeDragId?: string | null;
  onStartEdit?: (target: HabitEditTarget) => void;
  onCommitEdit?: (target: HabitEditTarget, name: string) => void;
  onCancelEdit?: (target: HabitEditTarget) => void;
}

// Month-at-a-glance view: one dot grid per habit, as many across as the viewport
// fits, collapsing to a single column when narrow. Ungrouped habits first, then
// one section per group.
//
// Only root habits appear here, so only roots can be dragged - a sub-habit has
// no card to pick up, and this view deliberately does not invent one. Roots can
// be reordered and moved between groups; nesting stays a timeline gesture.
export function HabitCalendar({
  sections,
  today,
  year,
  month,
  weekStart,
  onMonthChange,
  onToggleDay,
  editing,
  activeDragId,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: HabitCalendarProps) {
  const { setOverlayNode } = usePlannerDrag();

  // What travels under the pointer: the card itself for a habit, and the
  // heading for a group, which has no card of its own.
  const dragged = useMemo(() => {
    if (!activeDragId) return null;

    const group = sections.groups.find((s) => s.group.id === activeDragId);
    if (group) {
      return (
        <HabitBlockPreview
          name={group.group.name}
          count={group.habits.length}
          kind="habit-group"
        />
      );
    }

    const node = [...sections.ungrouped, ...sections.groups.flatMap((s) => s.habits)].find(
      (n) => n.id === activeDragId,
    );
    return node ? (
      <HabitCalendarCardPreview
        node={node}
        today={today}
        year={year}
        month={month}
        weekStart={weekStart}
      />
    ) : null;
  }, [sections, activeDragId, today, year, month, weekStart]);

  useEffect(() => {
    if (!dragged) return;
    setOverlayNode(dragged);
    return () => setOverlayNode(null);
  }, [dragged, setOverlayNode]);

  const hasAnything =
    sections.ungrouped.length > 0 || sections.groups.some((s) => s.habits.length > 0);

  const cardIds = [
    ...sections.ungrouped.map((n) => n.id),
    ...sections.groups.flatMap((s) => s.habits.map((n) => n.id)),
  ];

  const editProps = { editing, onStartEdit, onCommitEdit, onCancelEdit, activeDragId };

  return (
    <div className="habit-calendar">
      <div className="habit-calendar-selector-sticky">
        <MonthSelector year={year} month={month} onChange={onMonthChange} />
      </div>

      {!hasAnything && (
        <p className="habit-calendar-empty mt-8 text-sm text-ink-light opacity-60">
          No habits yet. Switch to the timeline to add one.
        </p>
      )}

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        {/* Registered even when empty, so a habit can be dragged back out of
            every group into the ungrouped list. */}
        <CalendarSectionDrop groupId={null}>
          {sections.ungrouped.length > 0 && (
            <HabitCalendarGrid
              habits={sections.ungrouped}
              groupId={null}
              today={today}
              year={year}
              month={month}
              weekStart={weekStart}
              onToggleDay={onToggleDay}
              {...editProps}
            />
          )}
        </CalendarSectionDrop>

        {sections.groups.map((section) => (
          <CalendarSectionDrop key={section.group.id} groupId={section.group.id}>
            <section className="habit-calendar-group mt-12">
              <SortableGroupHeading
                group={section.group}
                dimmed={activeDragId === section.group.id}
              >
                {editing?.kind === 'group' && editing.id === section.group.id ? (
                  <HabitNameInput
                    defaultValue={section.group.name}
                    className="uppercase tracking-[0.1em] text-[10px] font-semibold text-ink-light"
                    onCommit={(name) => onCommitEdit?.({ kind: 'group', id: section.group.id }, name)}
                    onCancel={() => onCancelEdit?.({ kind: 'group', id: section.group.id })}
                  />
                ) : (
                  <span
                    className="cursor-text"
                    onDoubleClick={() => onStartEdit?.({ kind: 'group', id: section.group.id })}
                  >
                    {section.group.name}
                  </span>
                )}
              </SortableGroupHeading>

              {section.habits.length > 0 ? (
                <HabitCalendarGrid
                  habits={section.habits}
                  groupId={section.group.id}
                  today={today}
                  year={year}
                  month={month}
                  weekStart={weekStart}
                  onToggleDay={onToggleDay}
                  {...editProps}
                />
              ) : (
                <p className="habit-calendar-group-empty mt-6 text-sm text-ink-light opacity-60">
                  No habits in this group.
                </p>
              )}
            </section>
          </CalendarSectionDrop>
        ))}
      </SortableContext>
    </div>
  );
}

/** One drop region: the ungrouped cards, or one group's cards. */
function CalendarSectionDrop({
  groupId,
  children,
}: {
  groupId: string | null;
  children: ReactNode;
}) {
  const data: HabitSectionDropData = { kind: 'habit-section', groupId };
  const { setNodeRef, isOver } = useDroppable({
    id: `calendar-section-${containerForGroup(groupId)}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      data-drop-target={isOver ? 'true' : undefined}
      className={`habit-calendar-section min-h-6 ${isOver ? 'habit-calendar-section--drop-target rounded-[6px] outline outline-1 outline-dot' : ''}`}
    >
      {children}
    </div>
  );
}

/** A group heading, draggable to reorder whole groups. */
function SortableGroupHeading({
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
    <h2
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging || dimmed ? 0.4 : 1 }}
      className="habit-calendar-group-name h-6 border-b border-border/60 text-[10px] font-semibold uppercase leading-6 tracking-[0.1em] text-ink-light"
      aria-label={group.name}
    >
      <HabitDragHandle label={group.name} />
      {children}
    </h2>
  );
}

interface HabitCalendarGridProps {
  habits: HabitNode[];
  groupId: string | null;
  today: Date;
  year: number;
  month: number;
  weekStart: WeekStart;
  onToggleDay: (node: HabitNode, iso: string) => void;
  editing?: HabitEditTarget;
  activeDragId?: string | null;
  onStartEdit?: (target: HabitEditTarget) => void;
  onCommitEdit?: (target: HabitEditTarget, name: string) => void;
  onCancelEdit?: (target: HabitEditTarget) => void;
}

function HabitCalendarGrid({
  habits,
  groupId,
  today,
  year,
  month,
  weekStart,
  onToggleDay,
  editing,
  activeDragId,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: HabitCalendarGridProps) {
  return (
    <div
      className="habit-calendar-grid mt-6 grid items-start gap-6"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${CARD_W}px)` }}
    >
      {habits.map((node) => (
        <SortableHabitCard
          key={node.id}
          node={node}
          groupId={groupId}
          dimmed={activeDragId === node.id}
        >
          <HabitCalendarHeading
            node={node}
            isEditing={editing?.kind === 'habit' && editing.id === node.id}
            onStartEdit={() => onStartEdit?.({ kind: 'habit', id: node.id })}
            onCommitEdit={(name) => onCommitEdit?.({ kind: 'habit', id: node.id }, name)}
            onCancelEdit={() => onCancelEdit?.({ kind: 'habit', id: node.id })}
          />
          <HabitMonthGrid
            year={year}
            month={month}
            weekStart={weekStart}
            today={today}
            label={node.name}
            stateFor={(iso) => dayState(node, iso)}
            onToggle={(iso) => onToggleDay(node, iso)}
          />
        </SortableHabitCard>
      ))}
    </div>
  );
}

/**
 * A whole card is the drag affordance here, rather than a handle: there is no
 * row to grab, and the press-and-hold constraint keeps a tap on a day cell from
 * ever becoming a drag.
 */
function SortableHabitCard({
  node,
  groupId,
  dimmed,
  children,
}: {
  node: HabitNode;
  groupId: string | null;
  dimmed: boolean;
  children: ReactNode;
}) {
  const data: HabitDragData = {
    kind: 'habit',
    habitId: node.id,
    parentId: null,
    groupId,
    containerId: containerForGroup(groupId),
    childIds: node.children.map((c) => c.id),
  };
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: node.id, data });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging || dimmed ? 0.4 : 1 }}
      className="habit-calendar-item min-w-0"
      aria-label={node.name}
    >
      {/*
       * Keyboard-only affordance, tucked into the grid gutter: pointer drag
       * already works card-wide, so this must not compete with the card itself.
       */}
      <HabitDragHandle label={node.name} className="absolute right-[-14px] top-0 h-4 w-4" />
      {children}
    </div>
  );
}

/**
 * The dragged card, drawn as it appears in the grid, for the drag overlay.
 *
 * Not the card component itself: that registers sortable hooks and owns edit
 * state, neither of which belongs to a copy floating under the pointer. A card
 * is self-contained here - heading and month grid, nothing spanning columns -
 * so the whole thing travels.
 */
function HabitCalendarCardPreview({
  node,
  today,
  year,
  month,
  weekStart,
}: {
  node: HabitNode;
  today: Date;
  year: number;
  month: number;
  weekStart: WeekStart;
}) {
  return (
    <div className="habit-calendar-card-preview min-w-0" style={{ width: CARD_W }} aria-hidden>
      <div className="habit-calendar-item-heading flex h-6 items-center">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-ink-lighter)' }} />
        </span>
        <span className="habit-calendar-item-name truncate text-sm leading-6 text-ink">
          {node.name}
        </span>
      </div>
      <HabitMonthGrid
        year={year}
        month={month}
        weekStart={weekStart}
        today={today}
        label={node.name}
        stateFor={(iso) => dayState(node, iso)}
        onToggle={() => {}}
      />
    </div>
  );
}

function HabitCalendarHeading({
  node,
  isEditing,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: {
  node: HabitNode;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommitEdit: (name: string) => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="habit-calendar-item-heading flex h-6 items-center">
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: 'var(--color-ink-lighter)' }}
        />
      </span>
      {isEditing ? (
        <HabitNameInput
          defaultValue={node.name}
          placeholder="Habit name"
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <span
          className="habit-calendar-item-name cursor-text truncate text-sm leading-6 text-ink"
          onDoubleClick={onStartEdit}
        >
          {node.name}
        </span>
      )}
    </div>
  );
}
