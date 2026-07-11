import { useState } from 'react';
import { SlidersHorizontal, List, LayoutGrid, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { Checkbox } from './Checkbox';

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
}: ViewToolbarProps) {
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
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      <Button variant="secondary" leftIcon={<SlidersHorizontal />} onClick={onFilter}>
        Filter
      </Button>

      <Checkbox
        checked={showCompleted}
        onChange={(e) => setShow(e.target.checked)}
        label="Show completed"
      />
      <Checkbox
        checked={moveCompleted}
        onChange={(e) => setMove(e.target.checked)}
        label="Move completed to end"
      />

      {/* Segmented List / Kanban toggle */}
      <div className="ml-auto inline-flex items-center rounded-[8px] border border-border overflow-hidden">
        {([
          { mode: 'list' as const, label: 'List', Icon: List },
          { mode: 'kanban' as const, label: 'Kanban', Icon: LayoutGrid },
        ]).map(({ mode, label, Icon }, i) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-sm font-journal leading-none transition-colors duration-[var(--motion-fast)] ${
              i > 0 ? 'border-l border-border' : ''
            } ${view === mode ? 'bg-dot/60 text-ink' : 'bg-transparent text-ink-light hover:bg-dot/30'}`}
          >
            <Icon size={15} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="More options"
        className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-ink-light hover:bg-dot/30 transition-colors duration-[var(--motion-fast)]"
      >
        <MoreHorizontal size={18} strokeWidth={1.5} />
      </button>
    </div>
  );
}
