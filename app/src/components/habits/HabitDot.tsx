import type { DayState } from '../../utils/habitTree';

export interface HabitDotProps {
  state: DayState;
  size?: number;
  /** Renders the hover affordance used by interactive day cells. */
  interactive?: boolean;
}

// The single source of truth for how a habit day looks, shared by the timeline
// and the calendar so a parent habit reads identically in both.
//
//   empty - outline only
//   half  - bottom half filled, for a parent whose sub-habits are partly done
//   full  - solid
export function HabitDot({ state, size = 8, interactive = false }: HabitDotProps) {
  const base = 'habit-dot absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full';
  const hover = interactive ? ' transition-colors group-hover:border-transparent group-hover:bg-dot/50' : '';

  if (state === 'full') {
    return (
      <span
        aria-hidden="true"
        className={`${base} habit-dot-full`}
        style={{ width: size, height: size, background: 'var(--color-ink-lighter)' }}
      />
    );
  }

  if (state === 'half') {
    return (
      <span
        aria-hidden="true"
        className={`${base} habit-dot-half border`}
        style={{
          width: size,
          height: size,
          borderColor: 'var(--color-dot)',
          background: 'linear-gradient(to top, var(--color-ink-lighter) 50%, transparent 50%)',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} habit-dot-empty border${hover}`}
      style={{ width: size, height: size, borderColor: 'var(--color-dot)' }}
    />
  );
}

// aria-pressed is a boolean, so a partially complete parent needs the tri-state
// checkbox role to be announced correctly.
export function dotAriaProps(state: DayState) {
  return state === 'half'
    ? ({ role: 'checkbox', 'aria-checked': 'mixed' } as const)
    : ({ role: 'checkbox', 'aria-checked': state === 'full' } as const);
}
