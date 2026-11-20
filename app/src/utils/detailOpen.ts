import type { KeyboardEvent, MouseEvent } from 'react';
import { NO_DRAG_ATTR } from '../components/dnd/sensors';

// Controls inside a row or card own their click: completing, menus, links and
// inline editing never also open details.
const OWN_CLICK = `a, button, input, textarea, select, label, [role="menuitem"], [contenteditable="true"], [${NO_DRAG_ATTR}]`;

/** A plain primary click on a noninteractive part of the row, with no text being selected. */
export function isOpenDetailsClick(event: MouseEvent<HTMLElement>): boolean {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  const owner = (event.target as HTMLElement).closest(OWN_CLICK);
  if (owner && owner !== event.currentTarget && event.currentTarget.contains(owner)) return false;
  const selection = window.getSelection();
  return !selection || selection.isCollapsed || selection.toString().trim() === '';
}

/** `o` on a focused row or card; Enter keeps adding below and Shift+Enter keeps renaming. */
export function isOpenDetailsKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'o' && !event.ctrlKey && !event.metaKey && !event.altKey && event.target === event.currentTarget;
}
