import type { ReactNode } from 'react';

// Small uppercase heading for a group of items inside the dropdown panel
// (e.g. "VIEW", "SHOW").
export function ToolbarSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="toolbar-section-label text-[11px] font-medium uppercase tracking-wide text-ink-light">
      {children}
    </span>
  );
}
