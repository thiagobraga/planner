import type { ReactNode } from 'react';

export interface ButtonGroupItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  showLabel?: boolean;
  disabled?: boolean;
}

type ButtonGroupSelection<T extends string> =
  | { mode: 'single'; value: T; onChange: (value: T) => void }
  | { mode: 'multi'; value: T[]; onChange: (value: T) => void };

export type ButtonGroupProps<T extends string> = ButtonGroupSelection<T> & {
  items: ButtonGroupItem<T>[];
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

// Full literal class tokens (not assembled via interpolation) so Tailwind's
// static scanner can see and generate every one of them.
const sizes = {
  xs: {
    height: 'h-5',
    padding: 'px-1.5',
    text: 'text-[11px]',
    gap: 'gap-1',
    radius: 'rounded-xs',
    radiusL: 'rounded-l-xs',
    radiusR: 'rounded-r-xs',
  },
  sm: {
    height: 'h-6',
    padding: 'px-2',
    text: 'text-[12px]',
    gap: 'gap-1',
    radius: 'rounded-[4px]',
    radiusL: 'rounded-l-[4px]',
    radiusR: 'rounded-r-[4px]',
  },
  md: {
    height: 'h-9',
    padding: 'px-3',
    text: 'text-sm',
    gap: 'gap-1.5',
    radius: 'rounded-[8px]',
    radiusL: 'rounded-l-[8px]',
    radiusR: 'rounded-r-[8px]',
  },
} as const;

// One reusable joined-pill segmented control for both single-select (radio-like,
// e.g. list/kanban) and multi-select (independent toggles, e.g. completed/notes)
// toolbar groups. Active segment gets the Button "primary" look; only the
// outer two corners of the group round, regardless of which segment is active.
export function ButtonGroup<T extends string>({
  mode,
  value,
  onChange,
  items,
  size = 'xs',
  disabled: groupDisabled = false,
  className = '',
  ...rest
}: ButtonGroupProps<T>) {
  const s = sizes[size];
  const isActive = (item: ButtonGroupItem<T>) =>
    mode === 'single' ? value === item.value : (value as T[]).includes(item.value);

  return (
    <div
      role="group"
      aria-label={rest['aria-label']}
      className={`ui-button-group inline-flex items-center border border-ink overflow-hidden ${s.radius} ${className}`}
    >
      {items.map((item, i) => {
        const active = isActive(item);
        const itemDisabled = groupDisabled || item.disabled;
        const showLabel = item.showLabel ?? !item.icon;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            aria-label={item.label}
            title={item.label}
            disabled={itemDisabled}
            onClick={() => {
              if (itemDisabled) return;
              onChange(item.value);
            }}
            className={`ui-button-group-item inline-flex items-center justify-center font-journal leading-none whitespace-nowrap transition-colors duration-(--motion-fast) disabled:cursor-not-allowed disabled:opacity-40 ${s.height} ${s.padding} ${s.text} ${s.gap} ${
              i > 0 ? 'border-l border-ink' : ''
            } ${i === 0 ? s.radiusL : ''} ${i === items.length - 1 ? s.radiusR : ''} ${
              active ? 'bg-ink text-cream' : 'bg-transparent text-ink hover:bg-dot/30'
            }`}
          >
            {item.icon && (
              <span className="ui-button-group-item-icon inline-flex items-center justify-center shrink-0">
                {item.icon}
              </span>
            )}
            {showLabel && <span>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
