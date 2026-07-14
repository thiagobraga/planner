import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

interface StripNavigatorProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  direction: 'previous' | 'next';
}

export function StripNavigator({ direction, className = '', ...props }: StripNavigatorProps) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      className={`strip-navigator flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-dot/20 text-ink-light transition-colors duration-[var(--motion-fast)] hover:bg-dot/35 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-dot/20 disabled:hover:text-ink-light ${className}`}
      {...props}
    >
      <Icon size={16} strokeWidth={1.8} />
    </button>
  );
}
