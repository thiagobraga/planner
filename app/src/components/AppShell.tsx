import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { QuickAdd } from './QuickAdd';
import { SearchOverlay } from './SearchOverlay';
import { matchKey, createMatcherState, DEFAULT_BINDINGS } from '../hooks/shortcuts';
import type { MatcherState } from '../hooks/shortcuts';
import { useSync } from '../hooks/useSync';

export function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  useSync(useCallback((event) => {
    if (event.entityType === 'task') qc.invalidateQueries();
  }, [qc]));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 640);

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile menu button — only shown below collapsed breakpoint (≥640px uses collapsed sidebar) */}
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
          style={{
            display: 'none',
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 60,
            background: 'var(--color-cream)',
            border: '1px solid var(--color-dot)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
          className="mobile-menu-btn"
        >
          ☰
        </button>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
      />

      <main
        className="main-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
        }}
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(44, 44, 44, 0.3)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-cream)',
              border: '1px solid var(--color-dot)',
              borderRadius: '6px',
              padding: '24px 32px',
              minWidth: '320px',
              boxShadow: '0 8px 32px rgba(44,44,44,0.15)',
            }}
          >
            <h2
              style={{
                fontFamily: '"Lora", serif',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: '0 0 16px',
              }}
            >
              Keyboard Shortcuts
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                    <td style={{ padding: '4px 0', width: '80px' }}>
                      {key.split(' ').map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span style={{ margin: '0 4px', color: 'var(--color-ink-light)' }}>then</span>}
                          <kbd
                            style={{
                              padding: '2px 6px',
                              background: 'var(--color-dot)',
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                            }}
                          >
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: '4px 0 4px 12px', color: 'var(--color-ink)' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                style={{
                  padding: '4px 16px',
                  background: 'var(--color-ink)',
                  color: 'var(--color-cream)',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: '"Lora", serif',
                }}
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
