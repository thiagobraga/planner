import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight } from 'lucide-react';
import { usePlannerDrag } from '../../contexts/usePlannerDrag';
import { useI18n } from '../../i18n/I18nContext';
import type { CollectionTreeRowProps } from '../../types/collections';
import type { CollectionDragData, CollectionDropData } from '../../types/drag';
import { DEPTH_PADDING_CLASSES } from '../../utils/collectionTree';
import { buildCollectionMenuItems } from '../collectionMenuItems';
import { ColorPickerPopover } from '../ui/ColorPickerPopover';
import { ContextMenu } from '../ui/ContextMenu';

export function SortableCollectionRow({
  item,
  depth,
  isActive,
  isEditing,
  hasChildren,
  isExpanded,
  draft,
  onNavigate,
  onStartRename,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onToggleCollapsed,
  onAddSub,
  onDelete,
  onColorCommit,
}: CollectionTreeRowProps) {
  const { t } = useI18n();
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // One payload serves both roles: this row is a peer to drag against when a
  // collection is moving, and a container to file into when a task is.
  const data: CollectionDragData & CollectionDropData = {
    kind: 'collection',
    collectionId: item.id,
    parentId: item.parentId,
    isInbox: false,
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data,
  });
  const { activeDrag, overId } = usePlannerDrag();
  const isTaskTarget = activeDrag?.kind === 'task' && overId === item.id;
  const depthClass = DEPTH_PADDING_CLASSES[Math.min(depth, DEPTH_PADDING_CLASSES.length - 1)];

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
        }}
        data-drop-target={isTaskTarget ? 'true' : undefined}
        className={`collection-row flex items-center gap-1.75 h-6 pr-2 text-[13px] text-ink ${depthClass} ${isActive ? 'collection-row--active font-medium' : ''} ${isTaskTarget ? 'collection-row--drop-target rounded-xs bg-(--planner-hover) outline outline-border-subtle' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextPos({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          const pos = { x: touch.clientX, y: touch.clientY };
          touchTimerRef.current = setTimeout(() => {
            setContextPos(pos);
          }, 400);
        }}
        onTouchMove={() => {
          if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        }}
        onTouchEnd={() => {
          if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="w-4 flex items-center justify-center shrink-0 cursor-grab"
          aria-label={`Reorder ${item.name}`}
        >
          <span
            className="w-1.75 h-1.75 rounded-full shrink-0 block filter-[saturate(0.55)]"
            style={{ background: item.color }}
          />
        </span>
        {isEditing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            className="flex-1 h-5 text-[13px] text-ink bg-transparent border-0 border-b border-border-subtle outline-none"
          />
        ) : (
          <>
            <button
              type="button"
              onClick={onNavigate}
              onDoubleClick={onStartRename}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 text-left bg-transparent border-0 cursor-pointer text-[13px] text-ink truncate p-0 ${isActive ? 'opacity-100' : 'opacity-60'}`}
            >
              {item.name}
            </button>
            {hasChildren && (
              <button
                type="button"
                aria-label={t(isExpanded ? 'page.collapseCollection' : 'page.expandCollection', { name: item.name })}
                aria-expanded={isExpanded}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapsed();
                }}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink-light"
              >
                <ChevronRight
                  aria-hidden="true"
                  size={14}
                  strokeWidth={1.5}
                  className={`transition-transform duration-(--motion-fast) ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
            )}
          </>
        )}
      </div>

      {contextPos && (
        <ContextMenu
          position={contextPos}
          onClose={() => setContextPos(null)}
          items={buildCollectionMenuItems(t, {
            onChangeColor: () => setColorPickerPos(contextPos),
            onStartRename,
            onAddSub,
            onDelete,
          })}
        />
      )}

      {colorPickerPos && (
        <ColorPickerPopover
          position={colorPickerPos}
          value={item.color}
          onCommit={onColorCommit}
          onClose={() => setColorPickerPos(null)}
        />
      )}
    </>
  );
}
