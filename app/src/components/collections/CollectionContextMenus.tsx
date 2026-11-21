import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Folder, Pencil, Trash2 } from 'lucide-react';
import { apiMoveTask, apiUpdateTask } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import type { ApiCollection, ApiStatus } from '../../types/api';
import type { SectionContextMenuState } from '../../types/collections';
import type { ContextMenuItem } from '../../types/contextMenu';
import type { Task, TaskSchedule } from '../../types/task';
import type { TaskIndentHandler, TaskIndentMenuContext } from '../../types/taskIndent';
import { flattenCollections } from '../../utils/collectionTree';
import { buildTaskMenuActions } from '../../utils/taskMenuActions';
import { buildSetDateMenuItem } from '../taskDateMenuItem';
import { buildIndentMenuItems } from '../taskIndentMenu';
import { ContextMenu } from '../ui/ContextMenu';

interface CollectionContextMenusProps {
  collectionId: string;
  collections: ApiCollection[];
  tasks: Task[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  contextMenu: TaskIndentMenuContext | null;
  onCloseContextMenu: () => void;
  sectionContextMenu: SectionContextMenuState | null;
  onCloseSectionContextMenu: () => void;
  onToggleTask: (taskId: string) => void;
  onSetSchedule: (taskId: string, schedule: TaskSchedule) => void;
  onAddAbove: (taskId: string) => void;
  onAddBelow: (taskId: string) => void;
  onIndent: TaskIndentHandler;
  onDeleteTask: (taskId: string) => void;
  onEditSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onInvalidate: () => void;
}

export function CollectionContextMenus({
  collectionId,
  collections,
  tasks,
  statuses,
  completionStatusId,
  contextMenu,
  onCloseContextMenu,
  sectionContextMenu,
  onCloseSectionContextMenu,
  onToggleTask,
  onSetSchedule,
  onAddAbove,
  onAddBelow,
  onIndent,
  onDeleteTask,
  onEditSection,
  onDeleteSection,
  onInvalidate,
}: CollectionContextMenusProps) {
  const { t } = useI18n();

  const projectSubmenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = flattenCollections(collections).map((c) => ({
      type: 'item',
      label: c.name,
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block filter-[saturate(0.55)]"
          style={{ backgroundColor: c.color, marginLeft: c.depth * 12 }}
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          apiUpdateTask(contextMenu.taskId, { collectionId: c.id }).catch(() => onInvalidate());
        }
      },
    }));

    items.push({
      type: 'item',
      label: t('contextMenu.noCollection'),
      icon: <span className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20" />,
      onClick: () => {
        if (contextMenu?.taskId) {
          const inbox = collections.find((c) => c.isInbox);
          if (inbox) {
            apiUpdateTask(contextMenu.taskId, { collectionId: inbox.id }).catch(() => onInvalidate());
          }
        }
      },
    });

    return items;
  }, [collections, contextMenu, onInvalidate, t]);

  const activeTask = contextMenu ? tasks.find((task) => task.id === contextMenu.taskId) : undefined;

  return (
    <>
      {contextMenu && (
        <ContextMenu
          caret
          position={contextMenu.position}
          onClose={onCloseContextMenu}
          items={[
            ...buildTaskMenuActions({
              task: activeTask,
              statuses,
              completionStatusId,
              t,
              onToggle: () => onToggleTask(contextMenu.taskId),
              onMove: (statusId) => {
                if (!activeTask || activeTask.parentTaskId) return;
                apiMoveTask(activeTask.id, {
                  parentTaskId: null,
                  collectionId,
                  statusId,
                  scope: { kind: 'status', collectionId, statusId },
                  position: Number.MAX_SAFE_INTEGER,
                })
                  .then(onInvalidate)
                  .catch(onInvalidate);
              },
            }),
            buildSetDateMenuItem(t, activeTask, onSetSchedule),
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
              onClick: () => onDeleteTask(contextMenu.taskId),
            },
          ]}
        />
      )}

      {sectionContextMenu && (
        <ContextMenu
          position={sectionContextMenu.position}
          onClose={onCloseSectionContextMenu}
          items={[
            {
              type: 'item',
              label: t('common.rename'),
              icon: <Pencil size={14} />,
              onClick: () => onEditSection(sectionContextMenu.sectionId),
            },
            { type: 'separator' },
            {
              type: 'item',
              label: t('common.delete'),
              icon: <Trash2 size={14} />,
              destructive: true,
              onClick: () => onDeleteSection(sectionContextMenu.sectionId),
            },
          ]}
        />
      )}
    </>
  );
}
