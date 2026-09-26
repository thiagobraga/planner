import type { ReactNode } from 'react';
import { List, Kanban, Calendar } from 'lucide-react';
import { KanbanListIcon } from './ViewToolbar';
import { useI18n } from '../../i18n/I18nContext';
import type { BoardViewMode } from '../../types/board';

export interface ViewSwitcherProps {
  view: BoardViewMode;
  onViewChange: (view: BoardViewMode) => void;
  className?: string;
}

const ICON_SIZE = 14;

// Always-visible List / Kanban lists / Kanban cards / Calendar buttons that sit
// beside the header hamburger. Separate buttons (not a joined ButtonGroup) so
// each reads as its own 24px affordance, like the hamburger itself.
export function ViewSwitcher({ view, onViewChange, className = '' }: ViewSwitcherProps) {
  const { t } = useI18n();

  const segments: { value: BoardViewMode; label: string; icon: ReactNode }[] = [
    { value: 'list', label: t('toolbar.list'), icon: <List size={ICON_SIZE} strokeWidth={1.5} /> },
    { value: 'kanban-list', label: t('toolbar.kanbanLists'), icon: <KanbanListIcon size={ICON_SIZE} /> },
    { value: 'kanban', label: t('toolbar.kanbanCards'), icon: <Kanban size={ICON_SIZE} strokeWidth={1.5} /> },
    { value: 'calendar', label: t('toolbar.calendar'), icon: <Calendar size={ICON_SIZE} strokeWidth={1.5} /> },
  ];

  return (
    <div role="group" className={`view-switcher inline-flex items-center gap-1 ${className}`}>
      {segments.map(({ value, label, icon }) => {
        const active = value === view;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onViewChange(value)}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors duration-(--motion-fast) ${
              active ? 'bg-ink text-cream border-ink' : 'text-ink-light border-transparent hover:bg-dot/30'
            }`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
