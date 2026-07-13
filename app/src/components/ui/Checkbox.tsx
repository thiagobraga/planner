import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

// 16px box, 4px radius, 1px border. Checked = ink fill with a cream check glyph.
export function Checkbox({ label, className = '', checked, ...rest }: CheckboxProps) {
  return (
    <label className={`ui-checkbox inline-flex items-start gap-3 cursor-pointer select-none ${className}`}>
      <span className="ui-checkbox-box relative inline-flex items-center justify-center shrink-0 w-4 h-4 mt-0.5">
        <input type="checkbox" checked={checked} className="ui-checkbox-input peer sr-only" {...rest} />
        <span
          className={`ui-checkbox-control w-4 h-4 rounded-[4px] border transition-colors duration-[var(--motion-fast)] ${
            checked ? 'bg-ink border-ink' : 'bg-cream border-border'
          }`}
        />
        {checked && (
          <Check size={11} strokeWidth={3} className="ui-checkbox-icon absolute text-cream pointer-events-none" />
        )}
      </span>
      {label && <span className="ui-checkbox-label flex-1 text-sm text-ink leading-6 text-left">{label}</span>}
    </label>
  );
}
