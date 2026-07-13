import type { InputHTMLAttributes, ReactNode } from 'react';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

// 16px circle, 1px border. Selected = ink ring with a small ink center dot.
export function Radio({ label, className = '', checked, ...rest }: RadioProps) {
  return (
    <label className={`ui-radio inline-flex items-start gap-3 cursor-pointer select-none ${className}`}>
      <span className="ui-radio-box relative inline-flex items-center justify-center shrink-0 w-4 h-4 mt-0.5">
        <input type="radio" checked={checked} className="ui-radio-input peer sr-only" {...rest} />
        <span
          className={`ui-radio-control w-4 h-4 rounded-full border transition-colors duration-[var(--motion-fast)] ${
            checked ? 'border-ink' : 'border-border'
          }`}
        />
        {checked && (
          <span className="ui-radio-dot absolute w-1.5 h-1.5 rounded-full bg-ink pointer-events-none" />
        )}
      </span>
      {label && <span className="ui-radio-label flex-1 text-sm text-ink leading-6 text-left">{label}</span>}
    </label>
  );
}
