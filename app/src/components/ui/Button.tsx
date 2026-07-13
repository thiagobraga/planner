import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  leftIcon?: ReactNode;
  children: ReactNode;
}

// Height 40px, radius 8px, left icon + 8px gap — per brand guide "BOTÕES".
const base =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[8px] text-sm font-journal leading-none whitespace-nowrap select-none transition-[opacity,background-color,color] duration-[var(--motion-fast)] disabled:cursor-not-allowed';

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
  leftIcon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`ui-button ${base} ${variants[variant]} ${className}`} {...rest}>
      {leftIcon && (
        <span className="ui-button-icon flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4">
          {leftIcon}
        </span>
      )}
      {children}
    </button>
  );
}
