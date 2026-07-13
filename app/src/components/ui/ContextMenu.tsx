import React, { useEffect, useRef, useState, KeyboardEvent, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  type: 'item' | 'separator';
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  // A context menu is just the root level of a nested menu structure
  return (
    <ContextMenuRoot items={items} position={position} onClose={onClose} />
  );
}

interface ContextMenuRootProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

function ContextMenuRoot({ items, position, onClose }: ContextMenuRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activePath, setActivePath] = useState<number[]>([]);

  // Focus the root container on mount so it can receive keyboard events
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Handle clicking outside to close
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Handle keyboard navigation at the root level
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      if (activePath.length > 0) {
        // If in a submenu, go back one level
        setActivePath((prev) => prev.slice(0, -1));
      } else {
        onClose();
      }
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ outline: 'none' }} // Remove focus outline on the wrapper
    >
      <MenuPanel
        items={items}
        position={position}
        level={0}
        activePath={activePath}
        setActivePath={setActivePath}
        onClose={onClose}
        isRoot={true}
      />
    </div>,
    document.body
  );
}

interface MenuPanelProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  level: number;
  activePath: number[];
  setActivePath: React.Dispatch<React.SetStateAction<number[]>>;
  onClose: () => void;
  isRoot?: boolean;
}

function MenuPanel({
  items,
  position,
  level,
  activePath,
  setActivePath,
  onClose,
  isRoot,
}: MenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: position.y, left: position.x });
  
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  
  // Find first non-disabled item on mount
  useEffect(() => {
    const firstActive = items.findIndex(i => i.type === 'item' && !i.disabled);
    setHighlightedIndex(firstActive >= 0 ? firstActive : -1);
  }, [items]);

  // Viewport-aware positioning
  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const padding = 8;

    let newTop = position.y;
    let newLeft = position.x;

    if (newLeft + rect.width > vw - padding) {
      if (isRoot) {
        newLeft = vw - rect.width - padding;
      } else {
        // Submenu: open to the left instead of right
        newLeft = position.x - rect.width - 180; // approximate width of parent + panel
      }
    }
    
    if (newTop + rect.height > vh - padding) {
      newTop = vh - rect.height - padding;
    }
    
    newLeft = Math.max(padding, newLeft);
    newTop = Math.max(padding, newTop);

    setCoords({ top: newTop, left: newLeft });
  }, [position, isRoot]);
  
  // If we are not the active panel (because a submenu is open), we shouldn't steal keyboard events
  const isActivePanel = activePath.length === level;

  // Track the submenu that is currently open (if any)
  const openSubmenuIndex = activePath[level];
  const activeItem = items[openSubmenuIndex];
  const hasSubmenu = activeItem?.type === 'item' && activeItem.submenu && activeItem.submenu.length > 0;
  
  // Keep the highlighted index synced with the open submenu
  useEffect(() => {
    if (openSubmenuIndex !== undefined) {
      setHighlightedIndex(openSubmenuIndex);
    }
  }, [openSubmenuIndex]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isActivePanel) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < items.length && (items[next].type === 'separator' || items[next].disabled)) next++;
          return next < items.length ? next : prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && (items[next].type === 'separator' || items[next].disabled)) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          const item = items[highlightedIndex];
          if (item.type === 'item' && item.submenu && item.submenu.length > 0 && !item.disabled) {
            setActivePath([...activePath, highlightedIndex]);
          }
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (!isRoot) {
          setActivePath(activePath.slice(0, -1));
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          const item = items[highlightedIndex];
          if (item.type === 'item' && !item.disabled) {
            if (item.submenu) {
              setActivePath([...activePath, highlightedIndex]);
            } else {
              item.onClick?.();
              onClose();
            }
          }
        }
        break;
    }
  };
  
  // Focus this panel when it becomes the active panel
  useEffect(() => {
    if (isActivePanel && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isActivePanel]);

  return (
    <>
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="fixed z-50 py-1 bg-cream border border-border rounded-md shadow-medium pointer-events-auto min-w-[180px]"
        style={{ top: coords.top, left: coords.left, outline: 'none' }}
        role="menu"
      >
        {items.map((item, index) => {
          if (item.type === 'separator') {
            return (
              <div
                key={`sep-${index}`}
                role="separator"
                className="h-[1px] bg-border my-1 mx-3"
              />
            );
          }

          const isHighlighted = highlightedIndex === index;
          const isSubmenuOpen = openSubmenuIndex === index;
          
          let itemClass = `flex items-center justify-between h-8 px-3 mx-1 rounded-[4px] text-[14px] font-journal cursor-pointer select-none outline-none transition-colors duration-75 `;
          
          if (item.disabled) {
            itemClass += `opacity-40 cursor-not-allowed text-ink-light `;
          } else if (item.destructive) {
            itemClass += `text-accent `;
            if (isHighlighted || isSubmenuOpen) itemClass += `bg-accent/10 `;
          } else {
            itemClass += `text-ink `;
            if (isHighlighted || isSubmenuOpen) itemClass += `bg-[#d4cfc7]/40 `;
          }

          return (
            <div
              key={`item-${index}`}
              data-index={index}
              role="menuitem"
              aria-disabled={item.disabled}
              className={itemClass}
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                
                if (item.submenu) {
                  setActivePath([...activePath.slice(0, level), index]);
                } else {
                  item.onClick?.();
                  onClose();
                }
              }}
              onMouseEnter={() => {
                if (!item.disabled) {
                  setHighlightedIndex(index);
                  // When hovering an item with a submenu, open it automatically (optional UX choice)
                  if (item.submenu) {
                     setActivePath([...activePath.slice(0, level), index]);
                  } else {
                     // If hovering a normal item, close any open sibling submenus
                     setActivePath(activePath.slice(0, level));
                  }
                }
              }}
            >
              <div className="flex items-center gap-2">
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </div>
              {item.submenu && (
                <ChevronRight size={14} className="text-ink-light ml-2" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Recursively render submenu if active */}
      {hasSubmenu && (
        <SubMenuWrapper
          parentItem={activeItem}
          parentRef={panelRef}
          itemIndex={openSubmenuIndex}
          level={level + 1}
          activePath={activePath}
          setActivePath={setActivePath}
          onClose={onClose}
        />
      )}
    </>
  );
}

interface SubMenuWrapperProps {
  parentItem: ContextMenuItem;
  parentRef: React.RefObject<HTMLDivElement>;
  itemIndex: number;
  level: number;
  activePath: number[];
  setActivePath: React.Dispatch<React.SetStateAction<number[]>>;
  onClose: () => void;
}

function SubMenuWrapper({
  parentItem,
  parentRef,
  itemIndex,
  level,
  activePath,
  setActivePath,
  onClose,
}: SubMenuWrapperProps) {
  // We need to position the submenu relative to the parent item
  const [position, setPosition] = useState({ x: -9999, y: -9999 });

  useLayoutEffect(() => {
    if (!parentRef.current) return;
    
    // Find the DOM node of the parent item
    const itemNodes = parentRef.current.querySelectorAll('[role="menuitem"]');
    
    // The itemIndex might include separators, so we need to account for that.
    // Actually, in our rendering, we used exact indices from the `items` array, 
    // so we can't just use `itemNodes[itemIndex]` because separators don't have role="menuitem".
    // Let's get all children and index them.
    const children = Array.from(parentRef.current.children);
    // Find the item with the correct key or index. It's safer to query the exact element.
    // In our loop, we didn't add a specific ID, but we can assume order matches.
    let itemEl: Element | null = null;
    let nodeIndex = 0;
    
    // Since we know the index in the original items array:
    // We can just get the offset relative to the parent ref.
    // A simpler way: just approximate by multiplying index * 32px (height of item)
    // but separators are smaller.
    
    // Let's attach a data attribute in MenuPanel to make it easy to find
    itemEl = parentRef.current.querySelector(`[data-index="${itemIndex}"]`);
    
    if (itemEl) {
      const rect = itemEl.getBoundingClientRect();
      setPosition({
        x: rect.right - 4, // slight overlap
        y: rect.top - 4,   // align with top of item
      });
    } else {
      // Fallback
      const rect = parentRef.current.getBoundingClientRect();
      setPosition({ x: rect.right, y: rect.top });
    }
  }, [itemIndex, parentRef]);

  if (!parentItem.submenu) return null;

  return (
    <MenuPanel
      items={parentItem.submenu}
      position={position}
      level={level}
      activePath={activePath}
      setActivePath={setActivePath}
      onClose={onClose}
    />
  );
}
