import { useState } from 'react';
import { SlidersHorizontal, ListTodo, Kanban, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Checkbox } from './Checkbox';
import { useI18n } from '../../i18n/I18nContext';

export type ViewMode = 'list' | 'kanban';

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

      {/* Segmented List / Kanban toggle */}
      <ButtonGroup
        mode="single"
        value={view}
        onChange={setView}
        size={compact ? 'sm' : 'md'}
        className={`ml-auto ${compact ? '' : 'mr-2.5'}`}
        items={[
          {
            value: 'list',
            label: t('toolbar.list'),
            showLabel: true,
            icon: <ListTodo size={compact ? 12 : 15} strokeWidth={1.5} />,
          },
          {
            value: 'kanban',
            label: t('toolbar.kanban'),
            showLabel: true,
            icon: <Kanban size={compact ? 12 : 15} strokeWidth={1.5} />,
          },
        ]}
      />

      {!viewOnly && <button
        type="button"
        aria-label={t('toolbar.moreOptions')}
        className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-light hover:bg-dot/30 transition-colors duration-(--motion-fast) mr-1"
      >
        <MoreHorizontal size={18} strokeWidth={1.5} />
      </button>}
    </div>
  );
}
