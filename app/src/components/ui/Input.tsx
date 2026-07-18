import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: boolean;
  helpText?: string;
  errorText?: string;
}

// 40px tall, 8px radius, 1px border, theme surface, leading icon 8px before value.
export function Input({
  icon,
  error = false,
  helpText,
  errorText,
  className = '',
  ...rest
}: InputProps) {
  const borderClass = error ? 'border-accent' : 'border-border focus-within:border-ink';
  const message = error ? errorText : helpText;

  return (
    <div className={`ui-input ${className}`}>
      <div
        className={`ui-input-container flex items-center gap-2 h-10 px-3 rounded-[8px] border bg-[var(--planner-control-bg)] ${borderClass} transition-colors duration-[var(--motion-fast)]`}
      >
        {icon && (
          <span className="ui-input-icon flex items-center justify-center shrink-0 text-ink-light [&_svg]:w-4 [&_svg]:h-4">
            {icon}
          </span>
        )}
        <input
          className="ui-input-field flex-1 p-0 min-w-0 bg-transparent border-0 outline-none text-sm text-ink placeholder:text-ink-light placeholder:opacity-50"
          {...rest}
        />
      </div>
      {message && (
        <p className={`ui-input-message mt-1 text-xs leading-5 ${error ? 'text-accent' : 'text-ink-light'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
