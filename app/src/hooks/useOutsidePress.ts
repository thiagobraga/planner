import { useEffect, type RefObject } from 'react';

/**
 * Call `onPress` when a press with either mouse button lands outside `ref`.
 * Listens to pointerdown, not mousedown: drag sensors cancel pointerdown on rows
 * and cards, which suppresses the mousedown that would follow. Bubble phase, so a
 * trigger that stops its own press can still toggle its menu closed.
 */
export function useOutsidePress(ref: RefObject<HTMLElement | null>, onPress: () => void): void {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onPress();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [ref, onPress]);
}
