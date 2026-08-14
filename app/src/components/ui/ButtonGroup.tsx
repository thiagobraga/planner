import type { ReactNode } from 'react';
import { Button, type ButtonSize } from './Button';

export interface ButtonGroupItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  showLabel?: boolean;
  disabled?: boolean;
}

type ButtonGroupSelection<T extends string> =
  | { mode: 'single'; value: T; onChange: (value: T) => void }
  | { mode: 'multi'; value: T[]; onChange: (value: T) => void };

export type ButtonGroupProps<T extends string> = ButtonGroupSelection<T> & {
  items: ButtonGroupItem<T>[];
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

// A segmented control built from real Button instances - same primary/
// secondary look as every other button in the app. Only the touching side of
// each segment is flattened (rounded-l-none / rounded-r-none), so adjacent
// items read as one joined pill without a separate bordered/overflow-hidden
// container.
export function ButtonGroup<T extends string>({
  mode,
  value,
  onChange,
  items,
  size = 'xs',
  disabled: groupDisabled = false,
  className = '',
  ...rest
}: ButtonGroupProps<T>) {
  const isActive = (item: ButtonGroupItem<T>) =>
    mode === 'single' ? value === item.value : (value as T[]).includes(item.value);

  return (
    <div
      role="group"
      aria-label={rest['aria-label']}
      className={`ui-button-group inline-flex items-center ${className}`}
    >
      {items.map((item, i) => {
        const active = isActive(item);
        const itemDisabled = groupDisabled || item.disabled;
        const showLabel = item.showLabel ?? !item.icon;
        const isFirst = i === 0;
        const isLast = i === items.length - 1;

        return (
          <Button
            key={item.value}
            variant={active ? 'primary' : 'secondary'}
            size={size}
            aria-pressed={active}
            aria-label={item.label}
            title={item.label}
            disabled={itemDisabled}
            onClick={() => {
              if (itemDisabled) return;
              onChange(item.value);
            }}
            className={`${!isFirst ? 'rounded-l-none -ml-px' : ''} ${!isLast ? 'rounded-r-none' : ''}`}
          >
            {item.icon}
            {showLabel && <span>{item.label}</span>}
          </Button>
        );
      })}
    </div>
  );
}
