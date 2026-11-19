import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import type { MenuButtonProps, MenuItemProps } from '../../types/toolbar';
import { Button } from '../ui/Button';

const FOCUSABLE = 'button:not([disabled])';

/** A small toolbar button, styled like Today, that opens a dropdown panel or a bottom sheet. */
export function MenuButton({ label, ariaLabel, align = 'end', sheet = false, className = '', children }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const coords = useFloatingPosition(triggerRef, panelRef, { placement: 'below', align, padding: 8 }, open && !sheet);

  const triggerId = useId();
  // Looked up by id rather than ref: children call this during their own handlers.
  const close = useCallback(() => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  }, [triggerId]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const initial = panel?.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"]')
      ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <>
      <Button
        ref={triggerRef}
        id={triggerId}
        variant="secondary"
        size="xs"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className={`page-menu-trigger !gap-1 ${open ? 'is-open' : ''} ${className}`}
      >
        <span className="page-menu-trigger-label">{label}</span>
        <ChevronDown size={12} strokeWidth={1.8} aria-hidden="true" />
      </Button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
          onKeyDown={onPanelKeyDown}
          className={sheet ? 'page-menu-sheet' : 'page-menu-panel'}
          style={sheet ? undefined : { top: coords.top, left: coords.left }}
        >
          {children(close)}
        </div>,
        document.body,
      )}
    </>
  );
}

export function MenuSection({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="page-menu-section" role="group" aria-label={typeof label === 'string' ? label : undefined}>
      <div className="page-menu-section-label">{label}</div>
      {children}
    </div>
  );
}

export function MenuItem({ label, icon, shortcut, checked, disabled, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className="page-menu-item"
    >
      <span className="page-menu-item-check" aria-hidden="true">{checked && <Check size={13} strokeWidth={2} />}</span>
      {icon && <span className="page-menu-item-icon" aria-hidden="true">{icon}</span>}
      <span className="page-menu-item-label">{label}</span>
      {shortcut && <kbd className="page-menu-item-shortcut">{shortcut}</kbd>}
    </button>
  );
}
