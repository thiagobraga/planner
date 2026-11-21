import { useMemo } from 'react';
import { apiUpdateTask } from '../api/client';
import type { ApiCollection } from '../types/api';
import type { ContextMenuItem } from '../types/contextMenu';
import type { TranslationKey } from '../types/i18n';
import { flattenCollections } from '../utils/collectionTree';

/** "Move to collection" submenu for the task under the context menu. */
export function useCollectionSubmenu(
  collections: ApiCollection[],
  contextMenuTaskId: string | undefined,
  invalidate: () => unknown,
  t: (key: TranslationKey) => string,
): ContextMenuItem[] {
  return useMemo<ContextMenuItem[]>(() => {
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
        if (contextMenuTaskId) apiUpdateTask(contextMenuTaskId, { collectionId: c.id }).catch(() => invalidate());
      },
    }));

    items.push({
      type: 'item' as const,
      label: t('contextMenu.noCollection'),
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20"
        />
      ),
      onClick: () => {
        const inbox = collections.find((c) => c.isInbox);
        if (inbox && contextMenuTaskId) {
          apiUpdateTask(contextMenuTaskId, { collectionId: inbox.id }).catch(() => invalidate());
        }
      },
    });

    return items;
  }, [collections, contextMenuTaskId, invalidate, t]);
}
