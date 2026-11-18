import { ChevronRight, Calendar, Flag, MoreHorizontal } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { PriorityDot } from './PriorityDot';
import { Chip } from './Chip';
import type { TaskRowSpecimenData } from '../../types/ui';

// Presentational task row matching the brand-guide "LINHAS DE TAREFA" spec.
// Kept separate from the live bullet-based TaskItem.
export function TaskRowSpecimen({
  title,
  priority,
  tags = [],
  date,
  completed = false,
  selected = false,
  flagged = false,
}: TaskRowSpecimenData) {
  return (
    <div
      className={`flex items-center gap-2 h-10 px-2 rounded-[8px] transition-colors duration-[var(--motion-fast)] ${
        selected ? 'bg-border-subtle/50' : 'hover:bg-border-subtle/30'
      }`}
    >
      <Checkbox checked={completed} readOnly />
      <ChevronRight size={15} strokeWidth={1.5} className="text-ink-light shrink-0" />
      <PriorityDot priority={priority} />

      <span
        className={`flex-1 min-w-0 truncate text-sm leading-none ${
          completed ? 'line-through text-ink-light' : 'text-ink'
        }`}
      >
        {title}
      </span>

      {tags.map((tag) => (
        <Chip key={tag}>#{tag}</Chip>
      ))}

      {date && (
        <span className="inline-flex items-center gap-1 text-xs text-ink-light whitespace-nowrap">
          <Calendar size={13} strokeWidth={1.5} />
          {date}
        </span>
      )}

      <Flag
        size={14}
        strokeWidth={1.5}
        className={`shrink-0 ${flagged ? 'text-danger-text fill-danger-text' : 'text-ink-light opacity-40'}`}
      />
      <MoreHorizontal size={16} strokeWidth={1.5} className="text-ink-light shrink-0" />
    </div>
  );
}
