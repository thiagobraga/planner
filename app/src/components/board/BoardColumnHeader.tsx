import { useMemo, useState, type HTMLAttributes } from 'react';
import type { BoardGroupBy } from '../../types/drag';
import { useI18n } from '../../i18n/I18nContext';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { ColorPickerPopover } from '../ui/ColorPickerPopover';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { InlineNameInput } from '../ui/InlineNameInput';
import type { ApiStatus } from '../../types/api';

interface BoardColumnHeaderProps {
  columnId: string;
  groupBy: BoardGroupBy;
  title: string;
  color?: string;
  isCompletionStatus?: boolean;
  canEdit?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (node: HTMLElement | null) => void;
  onRename?: (name: string) => void;
  onRecolor?: (color: string) => void;
  onMarkCompletion?: () => void;
  onDelete?: () => void;
  status?: ApiStatus;
  statuses?: ApiStatus[];
  onUpdateRoute?: (patch: Partial<Pick<ApiStatus, 'nextStatusMode' | 'nextStatusId' | 'acceptStatusId' | 'rejectStatusId'>>) => void;
}

export function BoardColumnHeader({
  columnId,
  groupBy,
  title,
  color,
  isCompletionStatus,
  canEdit = true,
  dragHandleProps,
  setDragHandleRef,
  onRename,
  onRecolor,
  onMarkCompletion,
  onDelete,
  status,
  statuses = [],
  onUpdateRoute,
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
    if (status && !isCompletionStatus && onUpdateRoute) {
      const destinations = [...statuses].sort((a, b) => a.orderValue - b.orderValue)
        .filter((candidate) => candidate.id !== status.id);
      items.push({ type: 'separator' });
      items.push({
        type: 'item', label: t('contextMenu.nextStage'), submenu: [
          { type: 'item', label: `${status.nextStatusMode === 'default' ? '✓ ' : ''}${t('contextMenu.defaultNextStage')}`, onClick: () => onUpdateRoute({ nextStatusMode: 'default', nextStatusId: null }) },
          ...destinations.map((destination): ContextMenuItem => ({ type: 'item', label: `${status.nextStatusMode === 'custom' && status.nextStatusId === destination.id ? '✓ ' : ''}${destination.name}`, onClick: () => onUpdateRoute({ nextStatusMode: 'custom', nextStatusId: destination.id }) })),
          { type: 'item', label: `${status.nextStatusMode === 'disabled' ? '✓ ' : ''}${t('contextMenu.disableNextStage')}`, onClick: () => onUpdateRoute({ nextStatusMode: 'disabled', nextStatusId: null }) },
        ],
      });
      for (const route of ['acceptStatusId', 'rejectStatusId'] as const) {
        items.push({
          type: 'item', label: t(route === 'acceptStatusId' ? 'contextMenu.acceptStage' : 'contextMenu.rejectStage'),
          submenu: [
            { type: 'item', label: `${!status[route] ? '✓ ' : ''}${t('contextMenu.noStage')}`, onClick: () => onUpdateRoute({ [route]: null }) },
            ...destinations.map((destination): ContextMenuItem => ({ type: 'item', label: `${status[route] === destination.id ? '✓ ' : ''}${destination.name}`, onClick: () => onUpdateRoute({ [route]: destination.id }) })),
          ],
        });
      }
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
  }, [groupBy, isCompletionStatus, menuPosition, onDelete, onMarkCompletion, onRecolor, onUpdateRoute, status, statuses, t]);

  return (
    <header
      ref={setDragHandleRef}
      className="board-column-header"
      {...dragHandleProps}
    >
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
