import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

/** The drawn box alone, shared by Checkbox and the habit day cells. `mixed` is a partly done parent. */
export function CheckboxMark({ checked, mixed = false }: { checked: boolean; mixed?: boolean }) {
  const filled = checked || mixed;
  const Icon = mixed ? Minus : Check;
  return (
    <span className="ui-checkbox-mark relative inline-flex items-center justify-center w-4 h-4 shrink-0">
      <span
        className={`ui-checkbox-control w-4 h-4 rounded-xs border transition-colors duration-(--motion-fast) ${
          filled ? 'bg-ink border-ink' : 'bg-(--planner-control-bg) border-ink-light/55'
        }`}
      />
      {filled && <Icon size={11} strokeWidth={3} className="ui-checkbox-icon absolute text-cream pointer-events-none" />}
    </span>
  );
}

// 16px box, 4px radius, 1px border. Checked = ink fill with a cream check glyph.
export function Checkbox({ label, className = '', checked, ...rest }: CheckboxProps) {
  return (
    <label className={`ui-checkbox inline-flex items-start gap-3 cursor-pointer select-none ${className}`}>
      <span className="ui-checkbox-box relative inline-flex items-center justify-center shrink-0 w-4 h-4 mt-0.5">
        <input type="checkbox" checked={checked} className="ui-checkbox-input peer sr-only" {...rest} />
        <CheckboxMark checked={!!checked} />
      </span>
      {label && <span className="ui-checkbox-label flex-1 text-sm text-ink leading-6 text-left">{label}</span>}
    </label>
  );
}
