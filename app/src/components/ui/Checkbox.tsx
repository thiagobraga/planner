import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

// 16px box, 4px radius, 1px border. Checked = ink fill with a cream check glyph.
export function Checkbox({ label, className = '', checked, ...rest }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${className}`}>
      <span className="relative inline-flex items-center justify-center shrink-0 w-4 h-4">
        <input type="checkbox" checked={checked} className="peer sr-only" {...rest} />
        <span
          className={`w-4 h-4 rounded-[4px] border transition-colors duration-[var(--motion-fast)] ${
            checked ? 'bg-ink border-ink' : 'bg-cream border-border'
          }`}
        />
        {checked && (
          <Check size={11} strokeWidth={3} className="absolute text-cream pointer-events-none" />
        )}
      </span>
      {label && <span className="text-sm text-ink leading-none">{label}</span>}
    </label>
  );
}
