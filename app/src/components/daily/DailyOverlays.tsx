import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Columns3, Folder, List, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { ContextMenu } from '../ui/ContextMenu';
import { flattenCollections } from '../CollectionTreeNav';
import { buildIndentMenuItems } from '../taskIndentMenu';
import { buildSetDateMenuItem } from '../taskDateMenuItem';
import { buildTaskMenuActions } from '../../utils/taskMenuActions';
import type { ContextMenuItem } from '../../types/contextMenu';
import type {
  DailyPageContextMenuProps,
  DailyReorganizeConfirmProps,
  DailyTaskContextMenuProps,
} from '../../types/daily';

export function DailyReorganizeConfirm({
  isVisible,
  onConfirm,
  onCancel,
}: DailyReorganizeConfirmProps) {
  const { t } = useI18n();
  if (!isVisible) return null;

  return (
    <span className="reorganize-confirm inline-flex items-center gap-1 text-[13px]">
      {t('reorganize.confirm')}
      <button
        className="text-accent underline text-decoration-color-accent cursor-pointer hover:opacity-80"
        onClick={() => {
          onConfirm().catch((err) => console.error('Reorganize failed', err));
        }}
      >
        {t('common.yes')}
      </button>
      <span>·</span>
      <button
        className="text-accent underline text-decoration-color-accent cursor-pointer hover:opacity-80"
        onClick={onCancel}
      >
        {t('common.no')}
      </button>
    </span>
  );
}

export function DailyPageContextMenu({
  position,
  layout,
  view,
  hideCompletedTasks,
  showNotes,
  onClose,
  onSetHideCompletedTasks,
  onSetShowNotes,
}: DailyPageContextMenuProps) {
  const { t } = useI18n();
  if (!position) return null;

  return (
    <ContextMenu
      caret={false}
      position={position}
      onClose={onClose}
      items={[
        {
          type: 'item',
          label: t('view.layout.list'),
          icon: <List size={14} />,
          checked: layout === 'list',
          onClick: () => view.setLayout('list'),
        },
        {
          type: 'item',
          label: t('view.layout.columns'),
          icon: <Columns3 size={14} />,
          checked: layout === 'columns',
          onClick: () => view.setLayout('columns'),
        },
        { type: 'separator' },
        {
          type: 'item',
          label: t('view.style.notebook'),
          checked: view.style === 'notebook',
          onClick: () => view.setStyle('notebook'),
        },
        {
          type: 'item',
          label: t('view.style.cards'),
          checked: view.style === 'cards',
          onClick: () => view.setStyle('cards'),
        },
        { type: 'separator' },
        {
          type: 'item',
          label: `${hideCompletedTasks ? '○' : '✓'} ${t('visibility.completedTasks')}`,
          onClick: () => onSetHideCompletedTasks(!hideCompletedTasks),
        },
        {
          type: 'item',
          label: `${showNotes ? '✓' : '○'} ${t('visibility.notes')}`,
          onClick: () => onSetShowNotes(!showNotes),
        },
      ]}
    />
  );
}

export function DailyTaskContextMenu({
  contextMenu,
  menuTask,
  statuses,
  completionStatusId,
  collections,
  onClose,
  onToggle,
  onMoveStatus,
  onSetSchedule,
  onAssignCollection,
  onAddAbove,
  onAddBelow,
  onIndent,
  onDelete,
}: DailyTaskContextMenuProps) {
  const { t } = useI18n();

  const projectSubmenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = flattenCollections(collections).map((c) => ({
      type: 'item' as const,
      label: c.name,
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block filter-[saturate(0.55)]"
          style={{ backgroundColor: c.color, marginLeft: c.depth * 12 }}
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          onAssignCollection(contextMenu.taskId, c.id);
        }
      },
    }));

    items.push({
      type: 'item' as const,
      label: t('contextMenu.noCollection'),
      icon: <span className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20" />,
      onClick: () => {
        if (contextMenu?.taskId) {
          const inbox = collections.find((c) => c.isInbox);
          if (inbox) {
            onAssignCollection(contextMenu.taskId, inbox.id);
          }
        }
      },
    });

    return items;
  }, [collections, contextMenu?.taskId, onAssignCollection, t]);

  if (!contextMenu) return null;

  return (
    <ContextMenu
      caret
      position={contextMenu.position}
      onClose={onClose}
      items={[
        ...buildTaskMenuActions({
          task: menuTask,
          statuses,
          completionStatusId,
          t,
          onToggle: () => onToggle(contextMenu.taskId),
          onMove: (statusId) => {
            if (!menuTask) return;
            onMoveStatus(menuTask, statusId);
          },
        }),
        buildSetDateMenuItem(t, menuTask, onSetSchedule),
        { type: 'item', label: t('contextMenu.collection'), icon: <Folder size={14} />, submenu: projectSubmenuItems },
        { type: 'separator' },
        {
          type: 'item',
          label: t('contextMenu.addAbove'),
          icon: <ArrowUp size={14} />,
          onClick: () => onAddAbove(contextMenu.taskId),
        },
        {
          type: 'item',
          label: t('contextMenu.addBelow'),
          icon: <ArrowDown size={14} />,
          onClick: () => onAddBelow(contextMenu.taskId),
        },
        ...buildIndentMenuItems(t, contextMenu, onIndent),
        { type: 'separator' },
        {
          type: 'item',
          label: t('common.delete'),
          icon: <Trash2 size={14} />,
          destructive: true,
          onClick: () => onDelete(contextMenu.taskId),
        },
      ]}
    />
  );
}
