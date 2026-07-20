import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { QuickAdd } from './QuickAdd';
import { SearchOverlay } from './SearchOverlay';
import { Button } from './ui/Button';
import { matchKey, createMatcherState, DEFAULT_BINDINGS } from '../hooks/shortcuts';
import type { MatcherState } from '../hooks/shortcuts';
import { useSync } from '../hooks/useSync';
import { fetchPreferences, type Preferences, apiCreateTask } from '../api/client';
import { ensureFontLoaded, type FontOption } from '../utils/fontLoader';
import { updateDocumentThemeColor } from '../utils/theme';
import { PlannerDragProvider } from '../contexts/PlannerDragContext';

const FONT_CLASSES: Record<FontOption, string> = {
  lora: 'font-journal',
  playpen: 'font-playpen',
  hubballi: 'font-hubballi',
};

export function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
    retry: 2,
  });

  useSync(useCallback((event) => {
    if (event.entityType === 'collection') {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    } else if (event.entityType === 'preferences') {
      if (event.payload && typeof event.payload === 'object') {
        qc.setQueryData<Preferences>(['preferences'], event.payload as Preferences);
      } else {
        qc.invalidateQueries({ queryKey: ['preferences'] });
      }
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    }
  }, [qc]));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 640);
  const isWhiteBackground = preferences?.background === 'white';
  const pageBackground = isWhiteBackground ? '#ffffff' : 'var(--color-cream)';
  const shellThemeStyle = {
    backgroundColor: pageBackground,
    '--color-dot': isWhiteBackground ? '#e5e1d8' : '#d8d3cb',
    '--color-sidebar-bg': isWhiteBackground ? '#f1f1f1' : '#ebe6de',
    '--planner-page-bg': pageBackground,
    '--planner-sidebar-bg': 'var(--color-sidebar-bg)',
    '--planner-card-bg': 'var(--color-sidebar-bg)',
    '--planner-sidebar-active-bg': isWhiteBackground ? 'rgba(212, 212, 212, 0.55)' : 'rgba(212, 207, 199, 0.5)',
    '--planner-sidebar-hover-bg': isWhiteBackground ? 'rgba(212, 212, 212, 0.35)' : 'rgba(212, 207, 199, 0.4)',
    '--planner-control-bg': isWhiteBackground ? '#ffffff' : 'rgba(245, 240, 232, 0.2)',
    '--planner-control-bg-hover': isWhiteBackground ? '#f5f5f5' : 'rgba(245, 240, 232, 0.35)',
    '--planner-toggle-off-bg': isWhiteBackground ? '#dedede' : 'var(--color-dot)',
    '--planner-toggle-knob-bg': isWhiteBackground ? '#ffffff' : 'var(--color-cream)',
    '--planner-settings-separator': isWhiteBackground ? '#d9d9d9' : '#d8d3cb',
    /* Monthly-specific tokens */
    '--planner-monthly-ledger-bg': isWhiteBackground ? 'rgba(255,255,255,0.24)' : 'rgba(245, 240, 232, 0.24)',
    '--planner-monthly-strip-selected': isWhiteBackground ? 'rgba(255,255,255,0.92)' : 'rgba(245, 240, 232, 0.90)',
    '--planner-monthly-strip-idle': isWhiteBackground ? 'rgba(255,255,255,0.55)' : 'rgba(245, 240, 232, 0.55)',
    '--planner-monthly-strip-hover': isWhiteBackground ? 'rgba(255,255,255,0.78)' : 'rgba(245, 240, 232, 0.75)',
    '--planner-monthly-weekend': 'rgba(245, 230, 198, 0.38)',
  } as CSSProperties;

  useEffect(() => {
    if (preferences?.font) {
      ensureFontLoaded(preferences.font);
    }
  }, [preferences?.font]);

  useEffect(() => {
    updateDocumentThemeColor(isWhiteBackground ? 'white' : 'beige');
  }, [isWhiteBackground]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const matcherStateRef = useRef<MatcherState>(createMatcherState());

  const isTextInputFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
  }, []);

  const handleAction = useCallback(
    (action: string | null) => {
      if (!action) return;
      switch (action) {
        case 'quickAdd:open':
          setQuickAddOpen(true);
          break;
        case 'search:focus':
          setSearchOpen(true);
          break;
        case 'help:open':
          setHelpOpen((v) => !v);
          break;
        case 'dialog:close':
          setQuickAddOpen(false);
          setSearchOpen(false);
          setHelpOpen(false);
          break;
        case 'navigate:inbox':
          navigate('/inbox');
          break;
        case 'navigate:daily':
          navigate('/daily');
          break;
        case 'navigate:upcoming':
          navigate('/upcoming');
          break;
      }
    },
    [navigate],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const event = {
        key: e.key,
        isTextInputFocused: isTextInputFocused(),
        timestamp: Date.now(),
      };
      const { action, nextState } = matchKey(DEFAULT_BINDINGS, matcherStateRef.current, event);
      matcherStateRef.current = nextState;
      if (action) {
        e.preventDefault();
        handleAction(action);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTextInputFocused, handleAction]);

  return (
    <div
      className={`app-shell flex h-screen overflow-hidden ${FONT_CLASSES[preferences?.font ?? 'lora']}${preferences?.smallCaps ? ' small-caps' : ''}`}
      style={shellThemeStyle}
    >
      {/* Mobile menu button - only shown below collapsed breakpoint (≥640px uses collapsed sidebar) */}
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
          className="app-shell-mobile-menu-btn mobile-menu-btn hidden fixed top-3 left-3 z-[60] bg-cream border border-dot rounded py-1 px-2 text-base cursor-pointer"
        >
          ☰
        </button>
      )}

      {/*
        Sidebar and page share one drag context so a task can be dragged out of a
        list and dropped onto a collection in the nav.
      */}
      <PlannerDragProvider>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
        />

        <main
          className="app-shell-main-content main-content flex-1 overflow-y-auto p-6"
          style={{
            backgroundColor: pageBackground,
            backgroundImage: preferences?.showDots === false ? 'none' : 'radial-gradient(circle, var(--color-dot) 1px, transparent 1px)',
            backgroundSize: preferences?.showDots === false ? undefined : 'var(--dot-grid) var(--dot-grid)',
            backgroundPosition: preferences?.showDots === false ? undefined : 'calc(var(--dot-grid)/2) calc(var(--dot-grid)/2)',
            backgroundRepeat: 'repeat',
          }}
        >
          <Outlet />
        </main>
      </PlannerDragProvider>

      {/* Overlays */}
      <QuickAdd
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSubmit={(title, dueDate, recurrenceRule) => {
          if (import.meta.env.DEV) console.log('Quick add:', { title, dueDate, recurrenceRule });
          apiCreateTask({ title, dueDate, recurrenceRule }).catch((err) => {
            console.error('Failed to quick add task:', err);
          });
        }}
      />

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Help panel */}
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={() => setHelpOpen(false)}
          className="app-shell-help-dialog fixed inset-0 z-[100] bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px] flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="app-shell-help-dialog-content bg-cream border border-dot rounded-md py-6 px-8 min-w-[320px] shadow-[0_8px_32px_rgba(44,44,44,0.15)]"
          >
            <h2 className="app-shell-help-title text-base font-semibold text-ink mb-4">
              Keyboard Shortcuts
            </h2>
            <table className="app-shell-help-shortcuts w-full border-collapse text-[13px]">
              <tbody>
                {[
                  ['q', 'Quick add task'],
                  ['/', 'Search'],
                  ['?', 'Toggle this panel'],
                  ['g i', 'Go to Inbox'],
                  ['g t', 'Go to Today'],
                  ['g u', 'Go to Upcoming'],
                  ['Enter', 'Edit selected task'],
                  ['Delete', 'Delete selected task'],
                  ['Esc', 'Close dialog'],
                ].map(([key, desc]) => (
                  <tr key={key}>
                    <td className="py-1 px-0 w-20">
                      {key.split(' ').map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1 text-ink-light">then</span>}
                          <kbd>{k}</kbd>
                        </span>
                      ))}
                    </td>
                    <td className="py-1 pl-3 text-ink">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="app-shell-help-footer mt-4 text-right">
              <Button variant="primary" onClick={() => setHelpOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
