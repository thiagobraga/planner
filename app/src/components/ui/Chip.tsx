import type { ReactNode } from 'react';

export interface ChipProps {
  children: ReactNode;
  className?: string;
}

// Generic tag/label chip: dot-grey pill, ink text.
export function Chip({ children, className = '' }: ChipProps) {
  return (
    <span
      className={`ui-chip inline-flex items-center text-[11px] leading-5 px-2 rounded-sm bg-dot/40 text-ink whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export interface CollectionChipProps {
  name: string;
  /** Literal CSS color value (hex/rgb(a)/hsl(a)); falls back to ink-light. */
  color?: string;
  className?: string;
}

// Collection chip: quiet dot-grey pill with a colored dot + name.
export function CollectionChip({ name, color, className = '' }: CollectionChipProps) {
  return (
    <span
      className={`ui-collection-chip inline-flex items-center gap-1.5 text-[11px] leading-5 px-2 rounded-sm bg-dot/40 text-ink whitespace-nowrap ${className}`}
    >
      <span
        className="ui-collection-chip-dot w-2 h-2 rounded-full shrink-0 filter-[saturate(0.55)]"
        style={{ backgroundColor: color || 'var(--color-ink-light)' }}
      />
      {name}
    </span>
  );
}
