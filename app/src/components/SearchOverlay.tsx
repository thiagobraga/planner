import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Task } from './TaskItem';

interface SearchResult {
  type: 'task' | 'collection' | 'label';
  id: string;
  title: string;
  subtitle?: string;
}

function groupResults(results: SearchResult[]) {
  const tasks = results.filter((r) => r.type === 'task');
  const collections = results.filter((r) => r.type === 'collection');
  const labels = results.filter((r) => r.type === 'label');
  return { tasks, collections, labels };
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  tasks?: Task[];
  collections?: Array<{ id: string; name: string }>;
  labels?: Array<{ id: string; name: string }>;
  onSelectTask?: (id: string) => void;
}

const EMPTY_TASKS: Task[] = [];
const EMPTY_COLLECTIONS: Array<{ id: string; name: string }> = [];
const EMPTY_LABELS: Array<{ id: string; name: string }> = [];

export function SearchOverlay({
  isOpen,
  onClose,
  tasks = EMPTY_TASKS,
  collections = EMPTY_COLLECTIONS,
  labels = EMPTY_LABELS,
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

  const grouped = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    const results: SearchResult[] = query.length >= 2
      ? [
          ...tasks
            .filter((t) => t.title.toLowerCase().includes(normalizedQuery))
            .slice(0, 10)
            .map((t) => ({ type: 'task' as const, id: t.id, title: t.title, subtitle: t.dueDate })),
          ...collections
            .filter((p) => p.name.toLowerCase().includes(normalizedQuery))
            .slice(0, 5)
            .map((p) => ({ type: 'collection' as const, id: p.id, title: p.name })),
          ...labels
            .filter((l) => l.name.toLowerCase().includes(normalizedQuery))
            .slice(0, 5)
            .map((l) => ({ type: 'label' as const, id: l.id, title: l.name })),
        ]
      : [];

    return groupResults(results);
  }, [collections, labels, query, tasks]);
  const flatResults = useMemo(
    () => [...grouped.tasks, ...grouped.collections, ...grouped.labels],
    [grouped],
  );

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
        <div className="px-5 h-6 text-[10px] tracking-[0.1em] uppercase text-ink-light font-medium leading-6">
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
              className={`px-5 h-12 cursor-pointer flex flex-col justify-center ${isActive ? 'bg-dot' : 'bg-transparent'}`}
            >
              <span className="text-sm text-ink leading-6">
                {item.title}
              </span>
              {item.subtitle && (
                <span className="text-[11px] text-ink-light italic leading-6">
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
      className="fixed inset-0 z-[100] bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px] flex items-start justify-center pt-20"
    >
      <div className="bg-cream rounded-md border border-dot w-[560px] max-w-[calc(100vw-48px)] shadow-[0_8px_32px_rgba(44,44,44,0.15)] overflow-hidden max-h-[60vh] flex flex-col">
        {/* Search input */}
        <div className="px-5 py-3.5 border-b border-dot flex items-center gap-2.5">
          <span className="text-base text-ink-light">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, collections, labels…"
            aria-label="Search"
            role="combobox"
            aria-expanded={flatResults.length > 0}
            aria-autocomplete="list"
            className="flex-1 text-[15px] leading-6 text-ink bg-transparent border-0 outline-none p-0"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="bg-transparent border-0 text-ink-light cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Results */}
        <div
          role="listbox"
          aria-label="search results"
          className="overflow-y-auto flex-1"
        >
          {query.length < 2 ? (
            <div className="px-5 py-6 text-[13px] text-ink-light italic">
              Type at least 2 characters to search…
            </div>
          ) : flatResults.length === 0 ? (
            <div className="px-5 py-6 text-[13px] text-ink-light italic">
              No results for "{query}"
            </div>
          ) : (
            <>
              {renderGroup('Tasks', grouped.tasks, 0)}
              {renderGroup('Collections', grouped.collections, grouped.tasks.length)}
              {renderGroup('Labels', grouped.labels, grouped.tasks.length + grouped.collections.length)}
            </>
          )}
        </div>

        {/* Footer hint */}
        {flatResults.length > 0 && (
          <div className="px-5 py-2 border-t border-dot text-[11px] text-ink-light flex gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>Esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
