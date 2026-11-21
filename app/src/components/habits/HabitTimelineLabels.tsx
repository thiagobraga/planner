import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { InlineNameInput } from '../ui/InlineNameInput';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { DebugCard } from '../DebugCard';
import { useDebugStore } from '../../stores/debugStore';
import { useI18n } from '../../i18n/I18nContext';
import type { HabitTimelineLabelsProps } from '../../types/habitTimeline';
import type { HabitEditTarget } from '../../types/habits';
import { INDENT } from '../../utils/habitTimeline';
import {
  RowOptionsButton,
  SortableGroupHeader,
  SortableHabitLabelRow,
  TimelineSectionDrop,
} from './HabitTimelineRowParts';

/** The name column: habit rows, group headers and add buttons, all draggable through the shared context. */
export function HabitTimelineLabels({
  sections,
  sortableIds,
  width,
  editing,
  collapsed,
  activeDragId,
  insertionBeforeId,
  insertionDepth,
  onOpenMenu,
  onToggleCollapse,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onAddHabit,
  onAddGroup,
}: HabitTimelineLabelsProps) {
  const { t } = useI18n();
  const debug = useDebugStore((s) => s.enabled);
  const isEditing = (kind: HabitEditTarget['kind'], id: string) => editing?.kind === kind && editing.id === id;

  return (
    <div className="habit-timeline-labels shrink-0 min-w-0" style={{ width }}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {sections.map((section) => (
          <TimelineSectionDrop key={section.key} groupId={section.groupId} droppable={section.droppable}>
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
                    className="habit-timeline-add-group group flex h-6 w-full min-w-0 items-center pr-2 text-ink-light opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center">+</span>
                    <span className="min-w-0 flex-1 truncate text-left uppercase tracking-widest text-[10px] font-semibold">
                      {t('page.newSection')}
                    </span>
                  </button>
                );
              }

              if (row.kind === 'add-habit') {
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => onAddHabit({ groupId: row.groupId })}
                    className="habit-timeline-add-habit group relative flex h-6 w-full min-w-0 items-center pr-2 text-ink-lighter transition-colors hover:text-ink"
                  >
                    <span className="absolute left-[-18px] flex h-6 w-4 items-center justify-center">
                      <Plus size={14} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left text-sm leading-6">{t('common.addHabit')}</span>
                  </button>
                );
              }

              if (row.kind === 'group-header') {
                const target: HabitEditTarget = { kind: 'group', id: row.group.id };
                return (
                  <SortableGroupHeader key={row.key} group={row.group} dimmed={activeDragId === row.group.id}>
                    {isEditing('group', row.group.id) ? (
                      <InlineNameInput
                        commitOnEscape
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
                          label={t('habit.optionsFor', { name: row.group.name })}
                          onOpen={(x, y) => onOpenMenu({ target, canAddSub: false, x, y })}
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
                  insertionDepth={insertionDepth}
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
                  ) : null}

                  {isEditing('habit', node.id) ? (
                    <InlineNameInput
                      commitOnEscape
                      defaultValue={node.name}
                      placeholder={t('common.addHabit')}
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
                      {debug && (
                        <DebugCard
                          id={node.id}
                          orderValue={node.orderValue}
                          createdAt={node.createdAt}
                          level={depth}
                          parentId={node.parentId}
                        />
                      )}
                      <RowOptionsButton
                        label={t('habit.optionsFor', { name: node.name })}
                        onOpen={(x, y) => onOpenMenu({ target, canAddSub: depth === 0, x, y })}
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
  );
}
