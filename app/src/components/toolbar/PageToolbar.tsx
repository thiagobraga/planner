import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import type { PageToolbarProps, ToolbarDensity } from '../../types/toolbar';

export const MOBILE_TOOLBAR_SLOT_ID = 'page-toolbar-mobile-slot';

/** Header widths (px) below which the toolbar gives up one more thing to keep to one row. */
const DENSITY_STEPS = [640, 560];

export function densityForWidth(width: number): ToolbarDensity {
  const step = DENSITY_STEPS.findIndex((min) => width >= min);
  return (step === -1 ? DENSITY_STEPS.length : step) as ToolbarDensity;
}

/**
 * The right side of a page title row: navigation (dates or grouping), then View.
 * Full width lives in the Planner menu.
 * On phones it moves into the bar above the bottom navbar.
 */
export function PageToolbar({ nav, view }: PageToolbarProps) {
  const mobile = useMediaQuery(PHONE_QUERY);
  const ref = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<ToolbarDensity>(0);

  useLayoutEffect(() => {
    const row = ref.current?.parentElement;
    if (!row || typeof ResizeObserver === 'undefined') return;
    // Zero means not laid out yet (or a test DOM); keep the roomy row until there is a width.
    const update = () => {
      if (row.clientWidth > 0) setDensity(densityForWidth(row.clientWidth));
    };
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

  return (
    <div ref={ref} className="page-toolbar" data-density={density}>
      {nav && (
        <>
          {nav(density, false)}
          <span className="page-toolbar-divider" aria-hidden="true" />
        </>
      )}
      {view({ sheet: false })}
    </div>
  );
}
