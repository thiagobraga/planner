import { useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { usePlannerDragHandlers } from '../contexts/PlannerDragContext';
import { apiUpdateSection } from '../api/client';
import type { Section } from '../stores/taskStore';
import type { SectionHeaderDragData } from '../types/drag';

interface UseSectionDragOptions {
  sections: Section[];
  setSections: (updater: (prev: Section[]) => Section[]) => void;
  /** Called after a failed reorder, so the page can refetch authoritative order. */
  onError?: () => void;
}

/**
 * Turns a drag gesture over a section header into a reorder.
 *
 * Sections are a flat, unnested list per collection, so unlike tasks there is
 * no reparenting or cross-scope move to project - only where in the list the
 * header lands. The server re-derives every sibling's order_value from a
 * single target index (see `updateSection`'s reorder branch), so the request
 * only ever needs to carry the moved section's new position.
 */
export function useSectionDrag({ sections, setSections, onError }: UseSectionDragOptions): void {
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = event.active.data.current as SectionHeaderDragData | undefined;
      const over = event.over?.data.current as SectionHeaderDragData | undefined;
      if (!active || !over || active.sectionId === over.sectionId) return;

      const ordered = [...sections].sort((a, b) => a.orderValue - b.orderValue);
      const activeIndex = ordered.findIndex((s) => s.id === active.sectionId);
      const overIndex = ordered.findIndex((s) => s.id === over.sectionId);
      if (activeIndex === -1 || overIndex === -1) return;

      const before = sections;
      const reordered = arrayMove(ordered, activeIndex, overIndex);
      setSections(() => reordered.map((s, i) => ({ ...s, orderValue: i })));

      apiUpdateSection(active.sectionId, { position: overIndex }).catch(() => {
        setSections(() => before);
        onError?.();
      });
    },
    [sections, setSections, onError],
  );

  usePlannerDragHandlers('section-header', { onDragEnd: handleDragEnd });
}
