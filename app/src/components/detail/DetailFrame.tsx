import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { closeTaskDetails, useTaskDetailStore } from '../../stores/taskDetailStore';
import type { DetailLayout } from '../../types/detail';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

// Survives remounts so one keyboard open moves focus exactly once.
let handledFocusRequest = 0;

/**
 * Desktop: a non-modal aside, focus stays where the user clicked unless they
 * opened it from the keyboard. Phone: a modal bottom sheet that keeps Tab
 * inside and closes from its scrim.
 */
export function DetailFrame({ layout, label, children }: { layout: DetailLayout; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const focusRequest = useTaskDetailStore((s) => s.focusRequest);
  const modal = layout === 'sheet';

  useEffect(() => {
    if (!modal && focusRequest === handledFocusRequest) return;
    handledFocusRequest = focusRequest;
    ref.current?.focus({ preventScroll: true });
  }, [focusRequest, modal]);

  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    if (!modal || event.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (modal) {
    return (
      <>
        <div className="detail-sheet-scrim" aria-hidden="true" onClick={() => closeTaskDetails()} />
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className="detail-panel detail-panel--sheet"
          onKeyDown={trapTab}
        >
          <span className="detail-sheet-handle" aria-hidden="true" />
          {children}
        </div>
      </>
    );
  }
  return (
    <aside ref={ref} aria-label={label} tabIndex={-1} className={`detail-panel detail-panel--${layout}`}>
      {children}
    </aside>
  );
}
