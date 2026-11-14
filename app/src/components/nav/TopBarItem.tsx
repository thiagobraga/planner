import { useQuery } from '@tanstack/react-query';
import { useDroppable } from '@dnd-kit/core';
import { Link, NavLink, useLocation } from 'react-router';
import { fetchCollections } from '../../api/client';
import { usePlannerDrag } from '../../contexts/usePlannerDrag';
import { useI18n } from '../../i18n/I18nContext';
import type { CollectionDropData } from '../../types/drag';
import type { TopBarItemProps } from '../../types/navigation';

export function TopBarItem({ item, ...linkProps }: TopBarItemProps) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const inCollection = item.to === '/collections' && pathname.startsWith('/collection/');
  const active = inCollection || pathname === item.to || pathname.startsWith(`${item.to}/`);
  const NavigationLink = inCollection ? Link : NavLink;
  return (
    <NavigationLink
      {...linkProps}
      to={item.to}
      aria-current={inCollection ? 'page' : undefined}
      className={`topbar-item${active ? ' topbar-item--active' : ''}`}
    >
      <span className="topbar-item-icon" aria-hidden="true"><item.Icon size={16} strokeWidth={1.5} /></span>
      <span className="topbar-item-label">{t(item.labelKey)}</span>
    </NavigationLink>
  );
}

export function InboxTopBarItem({ item }: TopBarItemProps) {
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const inboxId = collections.find((collection) => collection.isInbox)?.id;
  const { activeDrag, overId } = usePlannerDrag();
  const data: CollectionDropData | undefined = inboxId
    ? { kind: 'collection', collectionId: inboxId, isInbox: true, parentId: null }
    : undefined;
  const { setNodeRef } = useDroppable({ id: 'topbar-inbox', data, disabled: !inboxId });
  return (
    <TopBarItem
      item={item}
      ref={setNodeRef}
      data-drop-target={activeDrag?.kind === 'task' && overId === 'topbar-inbox' ? 'true' : undefined}
      onClickCapture={(event) => { if (activeDrag) event.preventDefault(); }}
    />
  );
}
