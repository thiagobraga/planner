import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
  // Always-visible controls rendered left of the hamburger (e.g. ViewSwitcher).
  viewSwitcher?: ReactNode;
}

// Small uppercase heading for a group of items inside the dropdown panel
// (e.g. "VIEW", "SHOW").
export function ToolbarSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="toolbar-section-label text-[11px] font-medium uppercase tracking-wide text-ink-light">
      {children}
    </span>
  );
}

// The header toolbar: owns the `page-header-toolbar` positioning class
// (top-right of the sticky page header) and collapses its children (Button,
// ButtonGroup, TaskVisibilityControls, BoardToolbar, ...) behind a single
// hamburger button, opened as a dropdown panel. Each page passes only its
// own hook class (e.g. "daily-page-header-controls") via className.
export function Toolbar({ children, className = '', viewSwitcher }: ToolbarProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`page-header-toolbar relative flex items-center gap-1 ${className}`}>
      {viewSwitcher}
      <button
        type="button"
        aria-label={t('toolbar.moreOptions')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-ink-light hover:bg-dot/30 transition-colors duration-(--motion-fast)"
      >
        <Menu size={14} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2.5 z-40 min-w-55 flex flex-col items-stretch gap-3 p-3 rounded-md border border-dot"
          style={{ backgroundColor: 'var(--planner-page-bg, var(--color-cream))', boxShadow: '0 8px 32px rgba(44,44,44,0.15)' }}
        >
          <div
            aria-hidden="true"
            className="absolute right-3 -top-1.5 w-3 h-3 rotate-45 border-t border-l border-dot"
            style={{ backgroundColor: 'var(--planner-page-bg, var(--color-cream))' }}
          />
          {children}
        </div>
      )}
    </div>
  );
}
