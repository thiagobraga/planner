import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { QuickAdd } from './QuickAdd';
import { SearchOverlay } from './SearchOverlay';
import { matchKey, createMatcherState, DEFAULT_BINDINGS } from '../hooks/shortcuts';
import type { MatcherState } from '../hooks/shortcuts';
import { useSync } from '../hooks/useSync';
import { fetchPreferences } from '../api/client';
import { ensureFontLoaded } from '../utils/fontLoader';

export function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
    retry: 2,
  });

  useSync(useCallback((event) => {
    if (event.entityType === 'task') {
      qc.invalidateQueries();
    } else if (event.entityType === 'project') {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
    }
  }, [qc]));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    if (preferences?.font) {
      ensureFontLoaded(preferences.font);
    }
  }, [preferences?.font]);

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
        case 'navigate:today':
          navigate('/today');
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
    <div className="flex h-screen overflow-hidden">
      {/* Mobile menu button — only shown below collapsed breakpoint (≥640px uses collapsed sidebar) */}
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
          className="mobile-menu-btn hidden fixed top-3 left-3 z-[60] bg-cream border border-dot rounded py-1 px-2 text-base cursor-pointer"
        >
          ☰
        </button>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <main
        className={`main-content flex-1 overflow-y-auto p-6 ${preferences?.font === 'patrick' ? 'font-patrick' : 'font-journal'}`}
      >
        <Outlet />
      </main>

      {/* Overlays */}
      <QuickAdd
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSubmit={(title) => {
          console.log('Quick add:', title);
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
          className="fixed inset-0 z-[100] bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px] flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-cream border border-dot rounded-md py-6 px-8 min-w-[320px] shadow-[0_8px_32px_rgba(44,44,44,0.15)]"
          >
            <h2 className="text-base font-semibold text-ink mb-4">
              Keyboard Shortcuts
            </h2>
            <table className="w-full border-collapse text-[13px]">
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
            <div className="mt-4 text-right">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="py-1 px-4 bg-ink text-cream border-0 rounded text-[13px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
