import { Archive, Pencil, Plus, Smile, Trash2 } from 'lucide-react';
import { ContextMenu } from '../ui/ContextMenu';
import { useI18n } from '../../i18n/I18nContext';
import type { HabitTimelineMenuProps } from '../../types/habitTimeline';

/** Rename, icon, sub-habit, archive and delete for one habit or group row. */
export function HabitTimelineMenu({
  menu,
  groupHasIcon,
  onClose,
  onStartEdit,
  onToggleGroupIcon,
  onAddHabit,
  onArchive,
  onDelete,
}: HabitTimelineMenuProps) {
  const { t } = useI18n();

  return (
    <ContextMenu
      position={{ x: menu.x, y: menu.y }}
      onClose={onClose}
      items={[
        {
          type: 'item',
          label: t('common.rename'),
          icon: <Pencil size={14} />,
          onClick: () => onStartEdit(menu.target),
        },
        ...(menu.target.kind === 'group'
          ? [
              {
                type: 'item' as const,
                label: groupHasIcon ? t('habit.removeIcon') : t('habit.addIcon'),
                icon: <Smile size={14} />,
                onClick: () => onToggleGroupIcon(menu.target.id),
              },
            ]
          : []),
        ...(menu.canAddSub
          ? [
              {
                type: 'item' as const,
                label: t('habit.addSubHabit'),
                icon: <Plus size={14} />,
                onClick: () => onAddHabit({ groupId: null, parentId: menu.target.id }),
              },
            ]
          : []),
        { type: 'separator' },
        {
          type: 'item',
          label: menu.target.kind === 'group' ? t('habit.archiveGroup') : t('habit.archive'),
          icon: <Archive size={14} />,
          onClick: () => onArchive(menu.target),
        },
        {
          type: 'item',
          label: menu.target.kind === 'group' ? t('habit.deleteGroup') : t('common.delete'),
          icon: <Trash2 size={14} />,
          destructive: true,
          onClick: () => onDelete(menu.target),
        },
      ]}
    />
  );
}
