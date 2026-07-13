import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

// Styled native <select>: same shell as Input with a trailing chevron.
export function Select({ error = false, className = '', children, ...rest }: SelectProps) {
  const borderClass = error ? 'border-accent' : 'border-border focus-within:border-ink';

  return (
    <div
      className={`ui-select relative flex items-center h-10 rounded-[8px] border bg-cream ${borderClass} transition-colors duration-[var(--motion-fast)] ${className}`}
    >
      <select
        className="ui-select-field peer flex-1 min-w-0 h-full px-3 pr-9 py-2 bg-transparent border-0 outline-none appearance-none text-sm text-ink cursor-pointer"
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.5}
        className="ui-select-chevron pointer-events-none absolute right-3 text-ink-light"
      />
    </div>
  );
}
