import { useState } from 'react';
import { SlidersHorizontal, List, LayoutGrid, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
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
      <div className={`ml-auto inline-flex items-center border border-border overflow-hidden ${compact ? 'h-6 rounded-[4px]' : 'rounded-[8px] mr-2.5'}`}>
        {([
          { mode: 'list' as const, label: t('toolbar.list'), Icon: List },
          { mode: 'kanban' as const, label: t('toolbar.kanban'), Icon: LayoutGrid },
        ]).map(({ mode, label, Icon }, i) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
            className={`inline-flex items-center font-journal leading-none transition-colors duration-[var(--motion-fast)] ${compact ? 'h-6 gap-1 px-2 text-[12px]' : 'h-9 gap-1.5 px-3 text-sm'} ${
              i > 0 ? 'border-l border-border' : ''
            } ${view === mode ? 'bg-dot/60 text-ink' : 'bg-transparent text-ink-light hover:bg-dot/30'}`}
          >
            <Icon size={compact ? 12 : 15} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {!viewOnly && <button
        type="button"
        aria-label={t('toolbar.moreOptions')}
        className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-ink-light hover:bg-dot/30 transition-colors duration-[var(--motion-fast)] mr-1"
      >
        <MoreHorizontal size={18} strokeWidth={1.5} />
      </button>}
    </div>
  );
}
