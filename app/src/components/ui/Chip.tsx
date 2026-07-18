import type { ReactNode } from 'react';
import { paletteColorHex } from '../../api/client';

export interface ChipProps {
  children: ReactNode;
  className?: string;
}

// Generic tag/label chip: dot-grey pill, ink text.
export function Chip({ children, className = '' }: ChipProps) {
  return (
    <span
      className={`ui-chip inline-flex items-center text-[11px] leading-6 px-2 rounded-[8px] bg-dot text-ink whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export interface CollectionChipProps {
  name: string;
  /** Named collection color (see PALETTE_COLORS); falls back to ink-light. */
  color?: string;
  className?: string;
}

// Collection chip: quiet dot-grey pill with a colored dot + name.
export function CollectionChip({ name, color, className = '' }: CollectionChipProps) {
  return (
    <span
      className={`ui-collection-chip inline-flex items-center gap-1.5 text-[11px] leading-6 px-2 rounded-[8px] bg-dot/60 text-ink whitespace-nowrap ${className}`}
    >
      <span
        className="ui-collection-chip-dot w-2 h-2 rounded-full shrink-0 [filter:saturate(0.55)]"
        style={{ backgroundColor: paletteColorHex(color) }}
      />
      {name}
    </span>
  );
}
