import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { BottomBar } from './BottomBar';
import { QuickAdd } from './QuickAdd';
import { SearchOverlay } from './SearchOverlay';
import { Button } from './ui/Button';
import { matchKey, createMatcherState, DEFAULT_BINDINGS } from '../hooks/shortcuts';
import type { MatcherState } from '../hooks/shortcuts';
import { useSync } from '../hooks/useSync';
import { fetchPreferences, type Preferences, apiCreateTask } from '../api/client';
import { ensureFontLoaded, type FontOption } from '../utils/fontLoader';
import { updateDocumentThemeColor } from '../utils/theme';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import type { BackgroundPreference } from '../types/theme';
import { PlannerDragProvider } from '../contexts/PlannerDragContext';
import { useI18n } from '../i18n/I18nContext';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { useTaskSelectionStore } from '../stores/taskSelectionStore';

const BACKGROUND_CACHE_KEY = 'planner_background';
const BACKGROUND_PREFERENCES: readonly BackgroundPreference[] = ['beige', 'white', 'dark', 'system'];

/** Last saved background, so a reload paints the right palette before preferences load. */
function cachedBackground(): BackgroundPreference {
  try {
    const value = localStorage.getItem(BACKGROUND_CACHE_KEY);
    return BACKGROUND_PREFERENCES.find((option) => option === value) ?? 'beige';
  } catch {
    return 'beige';
  }
}

const FONT_CLASSES: Record<FontOption, string> = {
  lora: 'font-journal',
  playpen: 'font-playpen',
  hubballi: 'font-hubballi',
};

export function AppShell() {
  const { setLocale, t } = useI18n();
  const updateAvailable = useVersionCheck();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { data: preferences, isPending: preferencesLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
    retry: 2,
  });

  useSync(useCallback((event) => {
    if (event.entityType === 'collection') {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    } else if (event.entityType === 'status' || event.entityType === 'label') {
      qc.invalidateQueries({ queryKey: ['collection'] });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['upcoming'] });
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
  const [useBottomBar, setUseBottomBar] = useState(() => window.innerWidth < 640);
  const theme = useResolvedTheme(preferences?.background ?? cachedBackground());

  useEffect(() => {
    if (preferences?.font) {
      ensureFontLoaded(preferences.font);
    }
  }, [preferences?.font]);

  useEffect(() => {
    if (preferences?.locale) {
      setLocale(preferences.locale);
    }
  }, [preferences?.locale, setLocale]);

  // Layout effect so the palette is on <html> before the first paint; the
  // cleanup hands logged-out screens back their default beige.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    updateDocumentThemeColor(theme);
    return () => {
      delete root.dataset.theme;
      updateDocumentThemeColor('beige');
    };
  }, [theme]);

  useEffect(() => {
    if (!preferences?.background) return;
    try {
      localStorage.setItem(BACKGROUND_CACHE_KEY, preferences.background);
    } catch {
      // Storage can be unavailable (private mode); the cache only avoids a flash.
    }
  }, [preferences?.background]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 479px)');
    const handler = (e: MediaQueryListEvent) => setUseBottomBar(e.matches);
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
        case 'navigate:habits':
          navigate('/habits');
          break;
        case 'navigate:settings':
          navigate('/settings');
          break;
        case 'toggle:upcoming':
          if (location.pathname !== '/daily') {
            navigate('/daily');
          }
          window.dispatchEvent(new CustomEvent('toggle-upcoming'));
          break;
      }
    },
    [navigate, location.pathname],
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

  useEffect(() => {
    // pointerdown, not click: a press held past the drag sensor's activation
    // delay makes dnd-kit swallow the click that follows it (see the note on
    // TaskItem's onPointerUp), which would otherwise make an outside click
    // silently fail to deselect too.
    const handler = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-task-id]')) return;
      useTaskSelectionStore.getState().clearSelection();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <div
      className={`app-shell flex h-screen bg-(--planner-page-bg) overflow-hidden ${FONT_CLASSES[preferences?.font ?? 'lora']}${preferences?.smallCaps ? ' small-caps' : ''}${useBottomBar ? ' app-shell--bottom-bar' : ''}`}
    >
      {/* Mobile menu button - only shown below collapsed breakpoint (≥640px uses collapsed sidebar) */}
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label={t('nav.open')}
          onClick={() => setSidebarOpen(true)}
          className="app-shell-mobile-menu-btn mobile-menu-btn hidden fixed top-3 left-3 z-[60] border border-dot rounded py-1 px-2 text-base cursor-pointer"
          style={{ backgroundColor: 'var(--planner-control-bg)' }}
        >
          ☰
        </button>
      )}

      {preferencesLoading ? (
        <div className="flex-1 flex items-center justify-center text-ink-light">
          {t('common.loading')}
        </div>
      ) : (
        <PlannerDragProvider>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            collapsed={useBottomBar ? false : sidebarCollapsed}
            updateAvailable={updateAvailable}
          />

          <main
            className="app-shell-main-content main-content flex-1 overflow-y-auto p-6"
            style={{
              backgroundColor: 'var(--planner-page-bg)',
              backgroundImage: preferences?.showDots === false ? 'none' : 'radial-gradient(circle, var(--color-dot) 1px, transparent 1px)',
              backgroundSize: preferences?.showDots === false ? undefined : 'var(--dot-grid) var(--dot-grid)',
              backgroundPosition: preferences?.showDots === false ? undefined : 'calc(var(--dot-grid)/2) calc(var(--dot-grid)/2)',
              backgroundRepeat: 'repeat',
            }}
          >
            <Outlet />
          </main>

          {useBottomBar && (
            <BottomBar
              isMenuOpen={sidebarOpen}
              onMenuToggle={() => setSidebarOpen((v) => !v)}
              onNavigate={() => setSidebarOpen(false)}
            />
          )}
        </PlannerDragProvider>
      )}

      {/* Overlays */}
      <QuickAdd
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSubmit={(title, dueDate, recurrenceRule, type) => {
          if (import.meta.env.DEV) console.log('Quick add:', { title, dueDate, recurrenceRule, type });
          apiCreateTask({ title, dueDate, recurrenceRule, type })
            .then((created) => {
              qc.invalidateQueries({ queryKey: ['today'] });
              qc.invalidateQueries({ queryKey: ['upcoming'] });
              qc.invalidateQueries({ queryKey: ['inbox'] });
              qc.invalidateQueries({ queryKey: ['tasks'] });
              window.dispatchEvent(new CustomEvent('task-created', { detail: created }));
            })
            .catch((err) => {
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
          aria-label={t('shell.keyboardShortcuts')}
          onClick={() => setHelpOpen(false)}
          className="app-shell-help-dialog fixed inset-0 z-[100] bg-(--planner-backdrop) backdrop-blur-[2px] flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="app-shell-help-dialog-content border border-dot rounded-md py-6 px-8 min-w-[320px] shadow-overlay"
            style={{ backgroundColor: 'var(--planner-overlay-bg)' }}
          >
            <h2 className="app-shell-help-title text-base font-semibold text-ink mb-4">
              {t('shell.keyboardShortcuts')}
            </h2>
            <table className="app-shell-help-shortcuts w-full border-collapse text-[13px]">
              <tbody>
                {[
                  ['q', t('shell.quickAddTask')],
                  ['/', t('common.search')],
                  ['?', t('shell.togglePanel')],
                  ['g i', t('shell.goInbox')],
                  ['g d', t('shell.goDaily')],
                  ['g h', t('shell.goHabits')],
                  ['g s', t('shell.goSettings')],
                  ['g u', t('shell.goUpcoming')],
                  ['Enter', t('shell.editSelected')],
                  ['Delete', t('shell.deleteSelected')],
                  ['Esc', t('shell.closeDialog')],
                ].map(([key, desc]) => (
                  <tr key={key}>
                    <td className="py-1 px-0 w-20">
                      {key.split(' ').map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1 text-ink-light">{t('shell.then')}</span>}
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
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
