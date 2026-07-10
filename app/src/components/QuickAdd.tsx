import { useState, useRef, useEffect, useCallback } from 'react';

interface ParsedDate {
  text: string;
  preview: string;
}

function parseNaturalDate(input: string): ParsedDate | null {
  const today = new Date();
  const lower = input.toLowerCase();

  const patterns: Array<{ re: RegExp; resolve: (m: RegExpMatchArray) => Date | null; label: string }> = [
    {
      re: /\btoday\b/,
      resolve: () => today,
      label: 'Today',
    },
    {
      re: /\btomorrow\b/,
      resolve: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
      },
      label: 'Tomorrow',
    },
    {
      re: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      resolve: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const target = days.indexOf(m[1]);
        const d = new Date(today);
        d.setDate(d.getDate() + ((target + 7 - d.getDay()) % 7 || 7));
        return d;
      },
      label: 'Next',
    },
    {
      re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      resolve: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const target = days.indexOf(m[1]);
        const d = new Date(today);
        const diff = (target + 7 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d;
      },
      label: '',
    },
    {
      re: /\bin (\d+) days?\b/,
      resolve: (m) => {
        const d = new Date(today);
        d.setDate(d.getDate() + parseInt(m[1]));
        return d;
      },
      label: '',
    },
    {
      re: /\bnext week\b/,
      resolve: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        return d;
      },
      label: 'Next week',
    },
  ];

  for (const { re, resolve } of patterns) {
    const m = lower.match(re);
    if (m) {
      const date = resolve(m);
      if (date) {
        return {
          text: m[0],
          preview: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        };
      }
    }
  }
  return null;
}

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, duePreview?: string) => void;
}

export function QuickAdd({ isOpen, onClose, onSubmit }: QuickAddProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = value ? parseNaturalDate(value) : null;

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed, parsed?.preview);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick add task"
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px] flex items-start justify-center pt-[120px]"
    >
      <div className="bg-cream rounded-md border border-dot w-[560px] max-w-[calc(100vw-48px)] shadow-[0_8px_32px_rgba(44,44,44,0.15)] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-2 border-b border-dot flex items-center justify-between">
          <span className="text-xs tracking-[0.08em] uppercase text-ink-light font-medium">
            Quick Add
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-0 text-ink-light cursor-pointer text-lg leading-none px-0.5"
          >
            ×
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-5 pt-3 pb-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task name. Try 'call mom today' or 'buy groceries tomorrow'"
            aria-label="Task title"
            className="w-full text-[15px] leading-6 text-ink bg-transparent border-0 outline-none p-0 caret-ink box-border"
          />

          {/* NLP date preview */}
          {parsed && (
            <div
              aria-live="polite"
              className="mt-2 flex items-center gap-1.5 text-xs text-ink-light"
            >
              <span className="text-[10px]">📅</span>
              <span className="italic">
                Recognized: <strong className="text-ink">{parsed.preview}</strong>
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex justify-between items-center h-6">
            <span className="text-[11px] text-ink-light">
              <kbd>Esc</kbd>
              {' '}to close
            </span>
            <button
              type="submit"
              disabled={!value.trim()}
              className={`py-1 px-4 border-0 rounded text-[13px] leading-6 transition-colors duration-[120ms] ${value.trim() ? 'bg-ink text-cream cursor-pointer' : 'bg-dot text-ink-light cursor-default'}`}
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
