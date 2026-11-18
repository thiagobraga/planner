import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StripNavigatorProps } from '../../types/ui';

export function StripNavigator({ direction, bordered = false, className = '', ...props }: StripNavigatorProps) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      className={`strip-navigator flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border ${bordered ? 'border-border' : 'border-transparent'} bg-[var(--planner-page-bg)] text-ink-light transition-colors duration-[var(--motion-fast)] hover:bg-border-subtle/35 hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-[var(--planner-page-bg)] disabled:hover:text-ink-light ${className}`}
      {...props}
    >
      <Icon size={14} strokeWidth={1.8} />
    </button>
  );
}
