import type { ChipProps, CollectionChipProps, TaskMetaChipProps } from '../../types/ui';

// Generic tag/label chip: dot-grey pill, ink text.
export function Chip({ children, className = '' }: ChipProps) {
  return (
    <span
      className={`ui-chip inline-flex items-center text-[11px] leading-5 px-2 rounded-sm bg-border-subtle/40 text-ink whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

// Quiet task-row metadata chip, optionally split into a tinted primary half and transparent secondary half.
export function TaskMetaChip({
  children,
  secondary,
  className = '',
  textClassName = 'text-ink/65',
  primaryClassName = '',
  secondaryClassName = '',
  title,
}: TaskMetaChipProps) {
  return (
    <span
      title={title}
      className={`ui-meta-chip inline-flex items-center text-[11px] leading-4.5 ${textClassName} whitespace-nowrap ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-1 bg-border-subtle/30 border border-border-subtle/50 ${
          secondary ? 'rounded-l-xs' : 'rounded-xs'
        } ${primaryClassName}`}
      >
        {children}
      </span>
      {secondary && (
        <span
          className={`inline-flex items-center px-1 bg-transparent border border-l-0 border-border-subtle/50 rounded-r-xs ${secondaryClassName}`}
        >
          {secondary}
        </span>
      )}
    </span>
  );
}

// Collection chip: quiet dot-grey pill with a colored dot + name, and optional section segment.
export function CollectionChip({ name, color, section, className = '' }: CollectionChipProps) {
  return (
    <TaskMetaChip
      className={`ui-collection-chip ${className}`}
      secondary={section}
      secondaryClassName="ui-collection-chip-section"
    >
      <span
        className="ui-collection-chip-dot w-1.75 h-1.75 rounded-full shrink-0 filter-[saturate(0.55)]"
        style={{ backgroundColor: color || 'var(--color-ink-light)' }}
      />
      {name}
    </TaskMetaChip>
  );
}
