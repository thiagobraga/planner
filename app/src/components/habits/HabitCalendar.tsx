import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { MonthSelector } from '../monthly/MonthSelector';
import { HabitMonthGrid } from './HabitMonthGrid';
import { HabitNameInput } from './HabitNameInput';
import { dayState, type HabitNode, type HabitSections } from '../../utils/habitTree';
import { containerForGroup } from '../../utils/habitProjection';
import type { HabitDragData, HabitGroupDragData, HabitSectionDropData } from '../../types/drag';
import type { HabitEditTarget } from './HabitTimeline';
import type { ApiHabitGroup } from '../../api/client';

export interface HabitCalendarProps {
  sections: HabitSections;
  today: Date;
  year: number;
  month: number;
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
  onMonthChange,
  onToggleDay,
  editing,
  activeDragId,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: HabitCalendarProps) {
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
    >
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
      style={{ gridTemplateColumns: 'repeat(auto-fill, 192px)' }}
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
    >
      {children}
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
