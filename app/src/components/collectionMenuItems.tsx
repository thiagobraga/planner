import { Palette, Pencil, FolderPlus, Trash2 } from 'lucide-react';
import type { ContextMenuItem } from './ui/ContextMenu';
import type { TranslationKey } from '../i18n/catalogs';

export interface CollectionMenuHandlers {
  onChangeColor: () => void;
  onStartRename: () => void;
  onAddSub: () => void;
  onDelete: () => void;
}

// The sidebar rows and the collection page breadcrumb offer the same actions;
// building the array here keeps the two call sites from drifting apart.
export function buildCollectionMenuItems(
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
  handlers: CollectionMenuHandlers,
): ContextMenuItem[] {
  return [
    {
      type: 'item',
      label: t('page.changeColor'),
      icon: <Palette size={14} />,
      onClick: handlers.onChangeColor,
    },
    {
      type: 'item',
      label: t('common.rename'),
      icon: <Pencil size={14} />,
      onClick: handlers.onStartRename,
    },
    {
      type: 'item',
      label: t('page.addSubCollection'),
      icon: <FolderPlus size={14} />,
      onClick: handlers.onAddSub,
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('common.delete'),
      icon: <Trash2 size={14} />,
      destructive: true,
      onClick: handlers.onDelete,
    },
  ];
}
