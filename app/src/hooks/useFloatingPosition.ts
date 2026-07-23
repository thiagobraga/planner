import { RefObject, useLayoutEffect, useState } from 'react';

type Position = { x: number; y: number };
type Placement = 'below' | 'above' | 'right' | 'left';
type Align = 'start' | 'end';

interface FloatingOptions {
  /** If provided, positions exactly at this coordinate (e.g. context menu) */
  position?: Position;
  /** Primary placement for anchor-based positioning */
  placement?: Placement;
  /** Alignment for anchor-based positioning */
  align?: Align;
  /** Minimum distance from viewport edges */
  padding?: number;
  /** Submenu offset if placing to the right/left */
  offset?: number;
}

interface FloatingResult {
  top: number;
  left: number;
  placement: Placement;
}

export function useFloatingPosition(
  triggerRef: RefObject<HTMLElement | null> | null,
  floatingRef: RefObject<HTMLElement | null>,
  options: FloatingOptions,
  isOpen: boolean
): FloatingResult {
  const [result, setResult] = useState<FloatingResult>({
    top: 0,
    left: 0,
    placement: options.placement || 'below',
  });

  useLayoutEffect(() => {
    if (!isOpen || !floatingRef.current) return;

    const updatePosition = () => {
      const floating = floatingRef.current;
      if (!floating) return;
      const floatingRect = floating.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const padding = options.padding ?? 8;
      const offset = options.offset ?? 0;

      let top = 0;
      let left = 0;
      let actualPlacement = options.placement || 'below';

      if (options.position) {
        // Coordinate-based positioning (Context Menu)
        top = options.position.y;
        left = options.position.x;

        // Handle right edge overflow
        if (left + floatingRect.width > viewportWidth - padding) {
          left = viewportWidth - floatingRect.width - padding;
        }
        // Handle bottom edge overflow
        if (top + floatingRect.height > viewportHeight - padding) {
          top = viewportHeight - floatingRect.height - padding;
        }
        
        // Ensure we don't go off the left/top edges either (viewport too small)
        left = Math.max(padding, left);
        top = Math.max(padding, top);
        
      } else if (triggerRef?.current) {
        // Anchor-based positioning (Select Dropdown)
        const triggerRect = triggerRef.current.getBoundingClientRect();

        if (options.placement === 'right') {
          left = triggerRect.right + offset;
          top = triggerRect.top;
          
          // Overflow right edge? Flip to left
          if (left + floatingRect.width > viewportWidth - padding) {
            left = triggerRect.left - floatingRect.width - offset;
            actualPlacement = 'left';
          }

          // Align vertical
          if (top + floatingRect.height > viewportHeight - padding) {
            top = viewportHeight - floatingRect.height - padding;
          }
        } else {
          // Vertical placement (above/below)
          const spaceBelow = viewportHeight - triggerRect.bottom;
          const spaceAbove = triggerRect.top;

          if (options.placement === 'above' || (spaceBelow < floatingRect.height + padding && spaceAbove > spaceBelow)) {
            actualPlacement = 'above';
            top = triggerRect.top - floatingRect.height - 4;
          } else {
            actualPlacement = 'below';
            top = triggerRect.bottom + 4;
          }

          if (options.align === 'end') {
            left = triggerRect.right - floatingRect.width;
          } else {
            left = triggerRect.left;
          }

          // Horizontal overflow correction
          if (left + floatingRect.width > viewportWidth - padding) {
            left = viewportWidth - floatingRect.width - padding;
          }
          if (left < padding) {
            left = padding;
          }
        }
      }

      setResult(prev => {
        if (prev.top === top && prev.left === left && prev.placement === actualPlacement) {
          return prev;
        }
        return { top, left, placement: actualPlacement };
      });
    };

    updatePosition();
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, triggerRef, floatingRef, options.position, options.placement, options.align, options.padding, options.offset]);

  return result;
}
