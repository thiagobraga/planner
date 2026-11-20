import { useEffect, type RefObject } from 'react';

/**
 * Call `onPress` when a press with either mouse button lands outside `ref`.
 * Listens to pointerdown in the capture phase: drag sensors cancel pointerdown
 * on rows and cards, which suppresses the mousedown that would follow.
 */
export function useOutsidePress(ref: RefObject<HTMLElement | null>, onPress: () => void): void {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onPress();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [ref, onPress]);
}
