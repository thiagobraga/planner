import { useState } from 'react';
import { SlidersHorizontal, List, Kanban, Calendar, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Checkbox } from './Checkbox';
import { useI18n } from '../../i18n/I18nContext';

import type { BoardViewMode } from '../../types/board';

export type ViewMode = BoardViewMode;
type Segment = ViewMode | 'calendar';

export function KanbanListIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M1.5 2.5h3M1.5 5h3M1.5 7.5h3M6.5 2.5h3M6.5 5h3M6.5 7.5h3M11.5 2.5h3M11.5 5h3M11.5 7.5h3" strokeLinecap="round" />
      <path d="M1.5 11.5h13" strokeLinecap="round" />
    </svg>
  );
}

export interface ViewToolbarProps {
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  showCompleted?: boolean;
  onShowCompletedChange?: (value: boolean) => void;
  moveCompleted?: boolean;
  onMoveCompletedChange?: (value: boolean) => void;
  onFilter?: () => void;
  className?: string;
  viewOnly?: boolean;
  compact?: boolean;
  showCalendar?: boolean;
  // When set, appends a non-selectable Calendar segment that fires this
  // callback instead of switching local view state (there is no in-page
  // calendar view). Callers own navigation.
  onCalendarClick?: () => void;
}

// View-options toolbar: Filter · Show completed · Move completed to end · List/Kanban · overflow.
export function ViewToolbar({
  view: viewProp,
  onViewChange,
  showCompleted: showCompletedProp,
  onShowCompletedChange,
  moveCompleted: moveCompletedProp,
  onMoveCompletedChange,
  onFilter,
  className = '',
  viewOnly = false,
  compact = false,
  showCalendar = false,
  onCalendarClick,
}: ViewToolbarProps) {
  const { t } = useI18n();
  const [viewState, setViewState] = useState<ViewMode>('list');
  const [showState, setShowState] = useState(true);
  const [moveState, setMoveState] = useState(true);

  const view = viewProp ?? viewState;
  const showCompleted = showCompletedProp ?? showState;
  const moveCompleted = moveCompletedProp ?? moveState;

  const setView = (v: ViewMode) => (onViewChange ? onViewChange(v) : setViewState(v));
  const setShow = (v: boolean) => (onShowCompletedChange ? onShowCompletedChange(v) : setShowState(v));
  const setMove = (v: boolean) => (onMoveCompletedChange ? onMoveCompletedChange(v) : setMoveState(v));

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${compact ? '' : 'pr-1'} ${className}`}>
      {!viewOnly && (
        <>
          <Button variant="secondary" leftIcon={<SlidersHorizontal />} onClick={onFilter}>
            {t('common.filter')}
          </Button>

          <Checkbox
            checked={showCompleted}
            onChange={(e) => setShow(e.target.checked)}
            label={t('toolbar.showCompleted')}
          />
          <Checkbox
            checked={moveCompleted}
            onChange={(e) => setMove(e.target.checked)}
            label={t('toolbar.moveCompleted')}
          />
        </>
      )}

      {/* Segmented List / Kanban / Calendar toggle - Calendar is a nav link, never active */}
      <ButtonGroup<Segment>
        mode="single"
        value={view}
        onChange={(v) => (v === 'calendar' ? onCalendarClick?.() : setView(v))}
        size='xs'
        className={compact ? '' : 'ml-auto mr-2.5'}
        items={[
          {
            value: 'list',
            label: t('toolbar.list'),
            showLabel: !compact,
            icon: <List size={compact ? 12 : 15} strokeWidth={1.5} />,
          },
          {
            value: 'kanban-list',
            label: t('toolbar.kanbanLists'),
            showLabel: !compact,
            icon: <KanbanListIcon size={compact ? 12 : 15} />,
          },
          {
            value: 'kanban',
            label: t('toolbar.kanbanCards'),
            showLabel: !compact,
            icon: <Kanban size={compact ? 12 : 15} strokeWidth={1.5} />,
          },
          ...(showCalendar || onCalendarClick
            ? [
                {
                  value: 'calendar' as const,
                  label: t('toolbar.calendar'),
                  showLabel: !compact,
                  icon: <Calendar size={compact ? 12 : 15} strokeWidth={1.5} />,
                },
              ]
            : []),
        ]}
      />

      {!viewOnly && <button
        type="button"
        aria-label={t('toolbar.moreOptions')}
        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-ink-light hover:bg-dot/30 transition-colors duration-(--motion-fast) mr-1"
      >
        <MoreHorizontal size={14} strokeWidth={1.5} />
      </button>}
    </div>
  );
}
