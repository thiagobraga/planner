import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import type { CollectionRowProps } from '../../types/collections';
import { isDesktopCollections } from '../../utils/collectionsLayout';
import { ContextMenu } from '../ui/ContextMenu';
import { ColorPickerPopover } from '../ui/ColorPickerPopover';
import { buildCollectionMenuItems } from '../collectionMenuItems';
import { isNativeContextMenu } from '../../utils/contextMenu';

export function CollectionRow({ node, depth, ...props }: CollectionRowProps) {
  const { t } = useI18n();
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPress = useRef(false);
  const clearTouchTimer = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };
  useEffect(() => clearTouchTimer, []);

  const isMenuOpen = props.menuOpenId === node.id;
  const isColorPickerOpen = props.colorPickerTarget?.id === node.id;
  const isRenaming = props.renamingId === node.id;
  const isAddingSub = props.addingSubFor === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = !props.collapsedIds.has(node.id);
  const childrenId = `collection-children-${node.id}`;

  const handleOpenMenu = (pos: { x: number; y: number }) => {
    setContextPos(pos);
    props.setMenuOpenId(node.id);
  };

  return (
    <div className="collections-index-node">
      <div
        className="collections-index-row grid h-6 cursor-pointer relative"
        style={{ gridTemplateColumns: '24px minmax(0, 1fr) auto', marginInlineStart: `${depth * 24}px` }}
        onContextMenu={(e) => {
          if (isNativeContextMenu(e)) return;
          e.preventDefault();
          handleOpenMenu({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          clearTouchTimer();
          longPress.current = false;
          const pos = { x: touch.clientX, y: touch.clientY };
          touchTimerRef.current = setTimeout(() => {
            longPress.current = true;
            handleOpenMenu(pos);
          }, 400);
        }}
        onTouchMove={clearTouchTimer}
        onTouchEnd={clearTouchTimer}
        onTouchCancel={clearTouchTimer}
      >
        {!isRenaming && hasChildren && (
          <button
            type="button"
            className="collections-index-row__toggle flex h-6 w-6 items-center justify-center p-0 text-ink-light hover:text-ink bg-transparent border-0 cursor-pointer"
            aria-label={t(isExpanded ? 'page.collapseCollection' : 'page.expandCollection', { name: node.name })}
            aria-expanded={isExpanded}
            aria-controls={childrenId}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleCollapsed(node.id);
            }}
          >
            <ChevronRight
              aria-hidden="true"
              size={16}
              strokeWidth={1.5}
              className={`motion-safe:transition-transform motion-safe:duration-(--motion-fast) ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}

        <button
          type="button"
          className="collections-index-dot flex h-6 w-6 items-center justify-center rounded-full p-0 bg-transparent border-0 cursor-pointer hover:bg-(--planner-sidebar-hover-bg) transition-colors"
          aria-label={t('collections.changeColorNamed', { name: node.name })}
          title={t('page.changeColor')}
          onMouseDown={(e) => {
            if (isColorPickerOpen) e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isColorPickerOpen) {
              props.onOpenColorPicker(null);
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            props.onOpenColorPicker({ id: node.id, position: { x: rect.left, y: rect.bottom } });
          }}
        >
          <span
            className="w-1.75 h-1.75 rounded-full translate-y-px shrink-0 filter-[saturate(0.55)]"
            style={{ backgroundColor: node.color }}
            aria-hidden="true"
          />
        </button>

        {isRenaming ? (
          <input
            autoFocus
            type="text"
            aria-label={t('page.collectionName')}
            value={props.editingName}
            onChange={(e) => props.setEditingName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onSaveRename(node);
              if (e.key === 'Escape') props.onCancelRename();
            }}
            onBlur={(event) => {
              if (isDesktopCollections() && event.relatedTarget?.closest('.collections-index-link')) return;
              props.onSaveRename(node);
            }}
            className="collections-inline-input col-start-2 col-span-2 min-w-0 h-6 text-sm leading-6 text-ink bg-transparent border-0 border-b border-border-subtle px-0"
          />
        ) : (
          <Link
            to={`/collection/${node.id}`}
            aria-current={props.activeId === node.id ? 'page' : undefined}
            className="collections-index-link min-w-0 truncate text-sm leading-6 text-ink-light"
            onMouseDown={(event) => {
              // Keep the tree's menu open when its neighbor link changes the detail pane.
              if (longPress.current || (props.menuOpenId && isDesktopCollections())) event.stopPropagation();
            }}
            onClick={(event) => {
              if (longPress.current) {
                longPress.current = false;
                if (event.detail > 0) {
                  event.preventDefault();
                  return;
                }
              }
              if (props.activeId === node.id && !event.metaKey && !event.ctrlKey &&
                  !event.altKey && !event.shiftKey && event.button === 0) event.preventDefault();
            }}
          >
            {node.name}
          </Link>
        )}

        {!isRenaming && (
          <div className="col-start-3 col-span-1 flex h-6 items-center justify-self-end shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="collections-index-row__actions-btn flex h-6 w-6 items-center justify-center p-0 text-ink-light hover:text-ink bg-transparent border-0 cursor-pointer"
              aria-label={t('collections.actionsNamed', { name: node.name })}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handleOpenMenu({ x: rect.left, y: rect.bottom });
              }}
            >
              <MoreHorizontal size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {isMenuOpen && contextPos && (
        <ContextMenu
          position={contextPos}
          onClose={() => {
            setContextPos(null);
            props.setMenuOpenId(null);
          }}
          items={buildCollectionMenuItems(t, {
            onChangeColor: () => {
              props.onOpenColorPicker({ id: node.id, position: contextPos });
              setContextPos(null);
            },
            onStartRename: () => {
              props.onRename(node);
              props.setMenuOpenId(null);
              setContextPos(null);
            },
            onAddSub: () => {
              props.onAddSub(node);
              props.setMenuOpenId(null);
              setContextPos(null);
            },
            ...(props.onSplit
              ? {
                  onSplitVertically: () => {
                    props.onSplit!(node, 'vertical');
                    props.setMenuOpenId(null);
                    setContextPos(null);
                  },
                  onSplitHorizontally: () => {
                    props.onSplit!(node, 'horizontal');
                    props.setMenuOpenId(null);
                    setContextPos(null);
                  },
                }
              : {}),
            onDelete: () => {
              props.onDelete(node);
              props.setMenuOpenId(null);
              setContextPos(null);
            },
          })}
        />
      )}

      {isColorPickerOpen && props.colorPickerTarget && (
        <ColorPickerPopover
          position={props.colorPickerTarget.position}
          value={node.color}
          onCommit={(color) => props.onColorCommit(node, color)}
          onClose={() => props.onOpenColorPicker(null)}
        />
      )}

      {isAddingSub && (
        <div
          className="collections-index-input-row grid h-6 items-center"
          style={{ gridTemplateColumns: '24px minmax(0, 1fr)', marginInlineStart: `${(depth + 1) * 24}px` }}
        >
          <span
            className="w-1.75 h-1.75 rounded-full justify-self-center self-center translate-y-px shrink-0 bg-border-subtle"
            aria-hidden="true"
          />
          <input
            autoFocus
            type="text"
            aria-label={t('page.collectionName')}
            placeholder={t('page.collectionName')}
            value={props.editingName}
            onChange={(e) => props.setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onSaveNewSub(node.id);
              if (e.key === 'Escape') props.onCancelNewSub();
            }}
            onBlur={() => props.onSaveNewSub(node.id)}
            className="collections-inline-input col-start-2 min-w-0 w-full h-6 text-sm leading-6 text-ink bg-transparent border-0 border-b border-border-subtle px-0 placeholder:text-ink-light/45"
          />
        </div>
      )}

      {hasChildren && (
        <div id={childrenId} role="group" aria-label={node.name} hidden={!isExpanded}>
          {node.children.map((child) => (
            <CollectionRow key={child.id} node={child} depth={depth + 1} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}
