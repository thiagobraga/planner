import { type ReactNode, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { HabitDragHandle } from './habits/HabitDragHandle';
import { HabitNameInput } from './habits/HabitNameInput';
import { NO_DRAG_ATTR } from './dnd/sensors';
import type { Section } from '../stores/taskStore';

interface SectionHeaderProps {
  section: Section;
  isEditing: boolean;
  onEdit: () => void;
  onCommitName: (name: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onReorder: (sectionId: string, position: number) => void;
}

export function SectionHeader({
  section,
  isEditing,
  onEdit,
  onCommitName,
  onCancelEdit,
  onDelete,
}: SectionHeaderProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: section.id,
    data: { kind: 'section', sectionId: section.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="group flex h-6 min-w-0 items-center pr-2"
      aria-label={section.name}
    >
      <HabitDragHandle label={section.name} />
      {isEditing ? (
        <HabitNameInput
          defaultValue={section.name}
          className="uppercase tracking-[0.1em] text-[10px] font-semibold text-ink-light"
          onCommit={onCommitName}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <span
            className="min-w-0 flex-1 cursor-text truncate text-[10px] font-semibold uppercase leading-6 tracking-[0.1em] text-ink-light"
            onDoubleClick={onEdit}
          >
            {section.name}
          </span>
          <SectionOptionsButton label={section.name} onDelete={onDelete} />
        </>
      )}
    </div>
  );
}

function SectionOptionsButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Options for section ${label}`}
        {...{ [NO_DRAG_ATTR]: '' }}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-ink-light opacity-0 transition-opacity duration-75 hover:bg-dot/30 hover:text-ink focus:opacity-100 group-hover:opacity-100"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span className="text-sm">⋯</span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-6 z-50 rounded-[4px] bg-cream border border-ink-light/20 shadow-lg">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-dot/10 first:rounded-t-[4px] last:rounded-b-[4px]"
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          >
            Delete section
          </button>
        </div>
      )}
    </div>
  );
}
