import { useState, useRef, useEffect, useCallback } from 'react';
import type { Task } from './TaskItem';

interface SearchResult {
  type: 'task' | 'project' | 'label';
  id: string;
  title: string;
  subtitle?: string;
}

function groupResults(results: SearchResult[]) {
  const tasks = results.filter((r) => r.type === 'task');
  const projects = results.filter((r) => r.type === 'project');
  const labels = results.filter((r) => r.type === 'label');
  return { tasks, projects, labels };
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  tasks?: Task[];
  projects?: Array<{ id: string; name: string }>;
  labels?: Array<{ id: string; name: string }>;
  onSelectTask?: (id: string) => void;
}

export function SearchOverlay({
  isOpen,
  onClose,
  tasks = [],
  projects = [],
  labels = [],
  onSelectTask,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results: SearchResult[] = query.length >= 2
    ? [
        ...tasks
          .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10)
          .map((t) => ({ type: 'task' as const, id: t.id, title: t.title, subtitle: t.dueDate })),
        ...projects
          .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map((p) => ({ type: 'project' as const, id: p.id, title: p.name })),
        ...labels
          .filter((l) => l.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map((l) => ({ type: 'label' as const, id: l.id, title: l.name })),
      ]
    : [];

  const grouped = groupResults(results);
  const flatResults = [...grouped.tasks, ...grouped.projects, ...grouped.labels];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && flatResults.length > 0) {
        const active = flatResults[activeIdx];
        if (active?.type === 'task') {
          onSelectTask?.(active.id);
          onClose();
        }
      }
    },
    [onClose, flatResults, activeIdx, onSelectTask],
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  if (!isOpen) return null;

  const renderGroup = (title: string, items: SearchResult[], baseIdx: number) => {
    if (items.length === 0) return null;
    return (
      <div key={title}>
        <div
          style={{
            padding: '0 20px',
            height: '24px',
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            fontWeight: 500,
            lineHeight: '24px',
          }}
        >
          {title}
        </div>
        {items.map((item, localIdx) => {
          const globalIdx = baseIdx + localIdx;
          const isActive = globalIdx === activeIdx;
          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.type === 'task') {
                  onSelectTask?.(item.id);
                  onClose();
                }
              }}
              style={{
                padding: '0 20px',
                height: '48px',
                cursor: 'pointer',
                background: isActive ? 'var(--color-dot)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--color-ink)', lineHeight: '24px' }}>
                {item.title}
              </span>
              {item.subtitle && (
                <span style={{ fontSize: '11px', color: 'var(--color-ink-light)', fontStyle: 'italic', lineHeight: '24px' }}>
                  {item.subtitle}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(44, 44, 44, 0.3)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
      }}
    >
      <div
        style={{
          background: 'var(--color-cream)',
          borderRadius: '6px',
          border: '1px solid var(--color-dot)',
          width: '560px',
          maxWidth: 'calc(100vw - 48px)',
          boxShadow: '0 8px 32px rgba(44,44,44,0.15)',
          overflow: 'hidden',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-dot)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '16px', color: 'var(--color-ink-light)' }}>⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, labels…"
            aria-label="Search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            style={{
              flex: 1,
              fontSize: '15px',
              lineHeight: '24px',
              fontFamily: '"Lora", serif',
              color: 'var(--color-ink)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-light)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Results */}
        <div
          role="listbox"
          aria-label="search results"
          style={{ overflowY: 'auto', flex: 1 }}
        >
          {query.length < 2 ? (
            <div
              style={{
                padding: '24px 20px',
                fontSize: '13px',
                color: 'var(--color-ink-light)',
                fontStyle: 'italic',
              }}
            >
              Type at least 2 characters to search…
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: '24px 20px',
                fontSize: '13px',
                color: 'var(--color-ink-light)',
                fontStyle: 'italic',
              }}
            >
              No results for "{query}"
            </div>
          ) : (
            <>
              {renderGroup('Tasks', grouped.tasks, 0)}
              {renderGroup('Projects', grouped.projects, grouped.tasks.length)}
              {renderGroup('Labels', grouped.labels, grouped.tasks.length + grouped.projects.length)}
            </>
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div
            style={{
              padding: '8px 20px',
              borderTop: '1px solid var(--color-dot)',
              fontSize: '11px',
              color: 'var(--color-ink-light)',
              display: 'flex',
              gap: '12px',
            }}
          >
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>Esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
