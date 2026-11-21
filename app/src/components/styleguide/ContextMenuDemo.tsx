import { useState } from 'react';
import { ContextMenu } from '../ui/ContextMenu';
import { isNativeContextMenu } from '../../utils/contextMenu';
import type { ContextMenuItem } from '../../types/contextMenu';

/** Styleguide specimen: right-click opens the app menu, Shift + right click the browser's. */
export function ContextMenuDemo({ items }: { items: ContextMenuItem[] }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <div
        className="h-32 border-2 border-dashed border-border rounded-md flex items-center justify-center bg-[#d4cfc7]/20 text-ink-light text-sm select-none"
        onContextMenu={(e) => {
          if (isNativeContextMenu(e)) return;
          e.preventDefault();
          setPosition({ x: e.clientX, y: e.clientY });
        }}
      >
        Right-click me
      </div>
      {position && <ContextMenu items={items} position={position} onClose={() => setPosition(null)} />}
    </>
  );
}
