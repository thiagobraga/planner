import type { ReactNode } from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  className?: string;
}

// Pill switch (role="switch") with theme-aware off track and knob surfaces.
export function Toggle({ checked, onChange, disabled = false, label, id, className = '' }: ToggleProps) {
  return (
    <label
      className={`ui-toggle inline-flex items-center gap-2 select-none ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      } ${className}`}
    >
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`ui-toggle-switch relative inline-flex items-center w-9 h-5 rounded-full border border-transparent transition-colors duration-[var(--motion-fast)] ${
          checked ? 'bg-ink' : 'bg-[var(--planner-toggle-off-bg)]'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`ui-toggle-knob inline-block w-4 h-4 rounded-full bg-[var(--planner-toggle-knob-bg)] transition-transform duration-[var(--motion-fast)] ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
      {label && <span className="ui-toggle-label flex-1 text-sm text-ink leading-6 text-left">{label}</span>}
    </label>
  );
}
