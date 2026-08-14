import { useMemo, useState, type HTMLAttributes } from 'react';
import type { BoardGroupBy } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { ColorPickerPopover } from '../ui/ColorPickerPopover';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { InlineNameInput } from '../ui/InlineNameInput';

interface BoardColumnHeaderProps {
  columnId: string;
  groupBy: BoardGroupBy;
  title: string;
  count: number;
  color?: string;
  isCompletionStatus?: boolean;
  canEdit?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (node: HTMLElement | null) => void;
  onRename?: (name: string) => void;
  onRecolor?: (color: string) => void;
  onMarkCompletion?: () => void;
  onDelete?: () => void;
}

export function BoardColumnHeader({
  columnId,
  groupBy,
  title,
  count,
  color,
  isCompletionStatus,
  canEdit = true,
  dragHandleProps,
  setDragHandleRef,
  onRename,
  onRecolor,
  onMarkCompletion,
  onDelete,
}: BoardColumnHeaderProps) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [colorPosition, setColorPosition] = useState<{ x: number; y: number } | null>(null);

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = [
      {
        type: 'item',
        label: t('board.renameColumn'),
        onClick: () => setRenaming(true),
      },
    ];

    if (groupBy === 'status' && onRecolor) {
      items.push({
        type: 'item',
        label: t('board.columnColor'),
        onClick: () => setColorPosition(menuPosition),
      });
    }
    if (groupBy === 'status' && !isCompletionStatus && onMarkCompletion) {
      items.push({
        type: 'item',
        label: t('board.markCompletion'),
        onClick: onMarkCompletion,
      });
    }
    if (onDelete) {
      items.push({ type: 'separator' });
      items.push({
        type: 'item',
        label: t('board.deleteColumn'),
        destructive: true,
        onClick: onDelete,
      });
    }
    return items;
  }, [groupBy, isCompletionStatus, menuPosition, onDelete, onMarkCompletion, onRecolor, t]);

  return (
    <header
      ref={setDragHandleRef}
      className="board-column-header"
      {...dragHandleProps}
    >
      <span className="board-column-dot" style={{ backgroundColor: color ?? 'var(--color-ink-lighter)' }} />
      {renaming ? (
        <InlineNameInput
          defaultValue={title}
          className="board-column-name-input"
          onCommit={(name) => {
            setRenaming(false);
            if (name && name !== title) onRename?.(name);
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <h2 onDoubleClick={() => canEdit && setRenaming(true)}>{title}</h2>
      )}
      {count > 0 && <span className="board-column-count">{count}</span>}
      {canEdit && (
        <button
          type="button"
          aria-label={t('board.moreOptions', { title })}
          data-testid={`board-column-menu-${columnId}`}
          {...{ [NO_DRAG_ATTR]: '' }}
          className="board-column-menu"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            setMenuPosition({ x: rect.right, y: rect.bottom });
          }}
        >
          ···
        </button>
      )}
      {menuPosition && (
        <ContextMenu
          items={menuItems}
          position={menuPosition}
          onClose={() => setMenuPosition(null)}
        />
      )}
      {colorPosition && onRecolor && (
        <ColorPickerPopover
          position={colorPosition}
          value={color ?? '#adb9c1'}
          onCommit={onRecolor}
          onClose={() => setColorPosition(null)}
        />
      )}
    </header>
  );
}
