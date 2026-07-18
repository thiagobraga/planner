import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  children: ReactNode;
}

// Base styles shared by all sizes — height, padding, and radius are size-specific below.
const base =
  'inline-flex items-center justify-center gap-2 text-sm font-journal leading-none whitespace-nowrap select-none transition-[opacity,background-color,color] duration-[var(--motion-fast)] disabled:cursor-not-allowed';

// lg → 40px / 8px radius  (original brand spec)
// md → 32px / 6px radius
// sm → 24px / 2px radius   (fits one dotted row, matches month selector)
const sizes: Record<ButtonSize, string> = {
  lg: 'h-10 px-4 rounded-[8px]',
  md: 'h-8 px-3 rounded-[6px]',
  sm: 'h-6 px-2 rounded-[2px] text-[13px]',
  xs: 'h-5 px-1.5 rounded-[2px] text-[11px]',
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-cream border border-ink hover:opacity-90 disabled:opacity-40',
  secondary:
    'bg-transparent text-ink border border-border hover:bg-dot/30 disabled:opacity-40',
  tertiary:
    'bg-transparent text-ink border border-transparent hover:bg-dot/30 disabled:opacity-40',
  destructive:
    'bg-transparent text-accent border border-accent hover:bg-accent/10 disabled:opacity-40',
};

export function Button({
  variant = 'secondary',
  size = 'lg',
  leftIcon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`ui-button ${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {leftIcon && (
        <span className="ui-button-icon flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4">
          {leftIcon}
        </span>
      )}
      {children}
    </button>
  );
}
