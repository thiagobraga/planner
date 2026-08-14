import type { ReactNode } from 'react';

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

// The header toolbar row: owns the `page-header-toolbar` positioning class
// and lays out its children (Button, ButtonGroup, TaskVisibilityControls,
// BoardToolbar, ...) in a flex row. Each page passes only its own hook class
// (e.g. "daily-page-header-controls") via className.
export function Toolbar({ children, className = '' }: ToolbarProps) {
  return <div className={`page-header-toolbar flex items-center gap-2 ${className}`}>{children}</div>;
}
