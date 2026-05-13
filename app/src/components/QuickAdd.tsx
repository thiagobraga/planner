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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(44, 44, 44, 0.3)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '120px',
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
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 8px',
            borderBottom: '1px solid var(--color-dot)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              fontWeight: 500,
            }}
          >
            Quick Add
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-light)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: '12px 20px 16px' }}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task name. Try 'call mom today' or 'buy groceries tomorrow'"
            aria-label="Task title"
            style={{
              width: '100%',
              fontSize: '15px',
              lineHeight: '24px',
              fontFamily: '"Lora", serif',
              color: 'var(--color-ink)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              caretColor: 'var(--color-ink)',
              boxSizing: 'border-box',
            }}
          />

          {/* NLP date preview */}
          {parsed && (
            <div
              aria-live="polite"
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--color-ink-light)',
              }}
            >
              <span style={{ fontSize: '10px' }}>📅</span>
              <span style={{ fontStyle: 'italic' }}>
                Recognized: <strong style={{ color: 'var(--color-ink)' }}>{parsed.preview}</strong>
              </span>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
              <kbd style={{ padding: '1px 5px', background: 'var(--color-dot)', borderRadius: '3px', fontSize: '10px' }}>Esc</kbd>
              {' '}to close
            </span>
            <button
              type="submit"
              disabled={!value.trim()}
              style={{
                padding: '4px 16px',
                background: value.trim() ? 'var(--color-ink)' : 'var(--color-dot)',
                color: value.trim() ? 'var(--color-cream)' : 'var(--color-ink-light)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                lineHeight: '24px',
                fontFamily: '"Lora", serif',
                cursor: value.trim() ? 'pointer' : 'default',
                transition: 'background 120ms',
              }}
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
