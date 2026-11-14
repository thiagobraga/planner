import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import type { PageToolbarProps, ToolbarDensity } from '../../types/toolbar';
import { WindowItems, WindowMenu } from './WindowMenu';

export const MOBILE_TOOLBAR_SLOT_ID = 'page-toolbar-mobile-slot';

/** Header widths (px) below which the toolbar gives up one more thing to keep to one row. */
const DENSITY_STEPS = [640, 560, 480];

export function densityForWidth(width: number): ToolbarDensity {
  const step = DENSITY_STEPS.findIndex((min) => width >= min);
  return (step === -1 ? 3 : step) as ToolbarDensity;
}

/**
 * The right side of a page title row: navigation (dates or grouping), then View and Window.
 * On phones it moves into the bar above the bottom navbar.
 */
export function PageToolbar({ nav, view, fullWidth, onFullWidthChange }: PageToolbarProps) {
  const mobile = useMediaQuery(PHONE_QUERY);
  const ref = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<ToolbarDensity>(0);

  useLayoutEffect(() => {
    const row = ref.current?.parentElement;
    if (!row || typeof ResizeObserver === 'undefined') return;
    const update = () => setDensity(densityForWidth(row.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [mobile]);

  if (mobile) {
    const slot = document.getElementById(MOBILE_TOOLBAR_SLOT_ID);
    if (!slot) return null;
    return createPortal(
      <div className="page-toolbar page-toolbar--mobile" data-testid="page-toolbar-mobile">
        {nav?.(2, true)}
        {view({ sheet: true })}
      </div>,
      slot,
    );
  }

  const windowFolded = density === 3;
  return (
    <div ref={ref} className="page-toolbar" data-density={density}>
      {nav && (
        <>
          {nav(density, false)}
          <span className="page-toolbar-divider" aria-hidden="true" />
        </>
      )}
      {view({
        sheet: false,
        windowItems: windowFolded
          ? (close) => <WindowItems fullWidth={fullWidth} onFullWidthChange={onFullWidthChange} close={close} />
          : undefined,
      })}
      {!windowFolded && <WindowMenu fullWidth={fullWidth} onFullWidthChange={onFullWidthChange} />}
    </div>
  );
}
